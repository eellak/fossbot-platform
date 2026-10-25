"""Small native website CMS. Public endpoints expose immutable published snapshots only."""
import base64
import binascii
import copy
import datetime
import json
import re
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from database.database import User, WebsiteEntry, WebsiteTranslation, WebsiteRevision, WebsitePermission, WebsiteMedia
from models.models import UserRole
from routers.stage_sources import get_db, get_current_user

router = APIRouter(prefix='/website', tags=['Website'])
LOCALE = re.compile(r'^[a-z]{2,3}(?:-[A-Z]{2})?$')
SLUG = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')


def access(user, db):
    if not user.activated or user.access_revoked:
        raise HTTPException(403, 'Account is inactive')
    if user.role == UserRole.ADMIN:
        return 'admin'
    grant = db.get(WebsitePermission, user.id)
    return grant.role if grant else 'none'


def editor(user=Depends(get_current_user), db=Depends(get_db)):
    role = access(user, db)
    if role not in ('admin', 'editor', 'contributor'):
        raise HTTPException(403, 'Website editing access is required')
    return user


def publisher(user, db):
    if access(user, db) not in ('admin', 'editor'):
        raise HTTPException(403, 'Publishing access is required')


def administrator(user, db):
    if access(user, db) != 'admin':
        raise HTTPException(403, 'Administrator access is required')


def commit(db):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'This URL or translation already exists')


class TranslationInput(BaseModel):
    locale: str = Field(min_length=2, max_length=16)
    slug: str = Field(min_length=1, max_length=160)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default='', max_length=500)
    sections: list[dict] = Field(default_factory=list, max_length=40)
    expectedRevision: int = Field(default=0, ge=0)


class EntryInput(BaseModel):
    kind: Literal['home', 'page', 'post']


class GrantInput(BaseModel):
    user_id: int
    role: Literal['editor', 'contributor', 'none']


class MediaInput(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    data: str = Field(max_length=7_000_000)


def safe_url(value):
    if not value:
        return
    if not isinstance(value, str) or not (value.startswith('/') and not value.startswith('//') and not value.startswith('/\\') or value.startswith('https://')) or any(ord(c) < 32 for c in value):
        raise HTTPException(422, 'Links must be local paths or HTTPS URLs')


def validate(data):
    if not LOCALE.fullmatch(data.locale) or not SLUG.fullmatch(data.slug) or not data.title.strip():
        raise HTTPException(422, 'Use a language code, a lowercase URL slug and a title')
    if len(json.dumps(data.sections)) > 500_000:
        raise HTTPException(422, 'Page content is too large')
    for section in data.sections:
        if section.get('type') not in ('banner', 'text', 'image', 'cards', 'button'):
            raise HTTPException(422, 'Unknown page section')
        for key in ('title', 'text', 'alt', 'buttonLabel'):
            if key in section and (not isinstance(section[key], str) or len(section[key]) > 10000):
                raise HTTPException(422, 'Invalid section text')
        safe_url(section.get('href'))
        if section.get('image') and not re.fullmatch(r'/website/media/[0-9]+', str(section['image'])):
            raise HTTPException(422, 'Choose an uploaded website image')
        if section.get('type') == 'cards':
            cards = section.get('cards', [])
            if not isinstance(cards, list) or len(cards) > 12:
                raise HTTPException(422, 'Use up to 12 cards')
            for card in cards:
                if not isinstance(card, dict) or not isinstance(card.get('title', ''), str) or not isinstance(card.get('text', ''), str):
                    raise HTTPException(422, 'Invalid card')
                if len(card.get('title', '')) > 10000 or len(card.get('text', '')) > 10000: raise HTTPException(422, 'Card text is too long')
                safe_url(card.get('href'))
        if 'content' in section:
            def check(node, depth=0):
                if depth > 20 or not isinstance(node, dict) or node.get('type') not in ('doc','paragraph','text','heading','bulletList','orderedList','listItem','blockquote','codeBlock','hardBreak','horizontalRule'):
                    raise HTTPException(422, 'Unsupported rich text content')
                if 'text' in node and not isinstance(node['text'], str):
                    raise HTTPException(422, 'Invalid rich text')
                children, marks = node.get('content', []), node.get('marks', [])
                if not isinstance(children, list) or not isinstance(marks, list): raise HTTPException(422, 'Invalid rich text structure')
                if not isinstance(node.get('attrs', {}), dict): raise HTTPException(422, 'Invalid text attributes')
                for mark in marks:
                    if not isinstance(mark, dict) or not isinstance(mark.get('attrs', {}), dict): raise HTTPException(422, 'Invalid text formatting')
                    if mark.get('type') == 'link': safe_url(mark.get('attrs', {}).get('href'))
                for child in children: check(child, depth + 1)
            check(section['content'])


def snapshot(row):
    return dict(locale=row.locale, slug=row.slug, title=row.title, description=row.description, sections=copy.deepcopy(row.sections), revision=row.revision)


def draft(row):
    return {**snapshot(row), 'published': row.published, 'publishedAt': row.published_at, 'updatedAt': row.updated_at}


def entry(db, key):
    value = db.query(WebsiteEntry).filter_by(key=key).first()
    if not value: raise HTTPException(404, 'Page not found')
    return value


def translation(db, key, locale, expected=None):
    parent = entry(db, key)
    row = db.query(WebsiteTranslation).filter_by(entry_id=parent.id, locale=locale).with_for_update().first()
    if not row: raise HTTPException(404, 'Translation not found')
    if expected is not None and row.revision != expected: raise HTTPException(409, 'This draft changed. Reload it before saving.')
    return row


@router.get('/access')
def permissions(user=Depends(get_current_user), db: Session=Depends(get_db)):
    return {'role': access(user, db)}


@router.get('/permissions')
def list_permissions(user=Depends(editor), db: Session=Depends(get_db)):
    administrator(user, db)
    grants = {g.user_id:g.role for g in db.query(WebsitePermission).all()}
    return [{'id':u.id,'username':u.username,'role':'admin' if u.role == UserRole.ADMIN else grants.get(u.id,'none')} for u in db.query(User).order_by(User.username).all()]


@router.put('/permissions')
def grant_permission(data: GrantInput, user=Depends(editor), db: Session=Depends(get_db)):
    administrator(user, db)
    person = db.get(User, data.user_id)
    if not person or person.role == UserRole.ADMIN: raise HTTPException(422, 'Choose a non-administrator account')
    grant = db.get(WebsitePermission, person.id)
    if data.role == 'none':
        if grant: db.delete(grant)
    else:
        if not grant: grant = WebsitePermission(user_id=person.id); db.add(grant)
        grant.role = data.role
    commit(db)
    return {'ok':True}


@router.get('/entries')
def list_entries(user=Depends(editor), db: Session=Depends(get_db)):
    return [{'key':e.key,'kind':e.kind,'translations':[draft(t) for t in db.query(WebsiteTranslation).filter_by(entry_id=e.id).order_by(WebsiteTranslation.locale).all()]} for e in db.query(WebsiteEntry).order_by(WebsiteEntry.id.desc()).all()]


@router.post('/entries')
def create_entry(data: EntryInput, user=Depends(editor), db: Session=Depends(get_db)):
    key = 'home' if data.kind == 'home' else uuid.uuid4().hex
    existing = db.query(WebsiteEntry).filter_by(key=key).first()
    if not existing:
        db.add(WebsiteEntry(key=key,kind=data.kind)); commit(db)
    return {'key':key,'kind':data.kind,'translations':[]}


@router.put('/entries/{key}/{locale}')
def save_translation(key:str, locale:str, data:TranslationInput, user=Depends(editor), db: Session=Depends(get_db)):
    validate(data)
    if locale != data.locale: raise HTTPException(422, 'Language mismatch')
    parent = entry(db, key)
    row = db.query(WebsiteTranslation).filter_by(entry_id=parent.id,locale=locale).with_for_update().first()
    if (row.revision if row else 0) != data.expectedRevision: raise HTTPException(409, 'This draft changed. Reload it before saving.')
    if not row: row=WebsiteTranslation(entry_id=parent.id,locale=locale); db.add(row)
    row.slug=data.slug; row.title=data.title.strip(); row.description=data.description; row.sections=copy.deepcopy(data.sections)
    row.revision = (row.revision or 0)+1; row.updated_at=datetime.datetime.utcnow()
    try: db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'This URL or translation already exists')
    db.add(WebsiteRevision(translation_id=row.id,revision=row.revision,snapshot=snapshot(row),actor_id=user.id))
    commit(db)
    return draft(row)


@router.post('/entries/{key}/{locale}/publish')
def publish(key:str,locale:str,expectedRevision:int,user=Depends(editor),db: Session=Depends(get_db)):
    publisher(user,db)
    row=translation(db,key,locale,expectedRevision)
    if not row.sections: raise HTTPException(422,'Add content before publishing')
    row.published=snapshot(row); row.published_slug=row.slug; row.published_at=datetime.datetime.utcnow(); commit(db)
    return draft(row)


@router.post('/entries/{key}/{locale}/unpublish')
def unpublish(key:str,locale:str,expectedRevision:int,user=Depends(editor),db: Session=Depends(get_db)):
    publisher(user,db); row=translation(db,key,locale,expectedRevision)
    row.published=None; row.published_slug=None; row.published_at=None; commit(db)
    return draft(row)


@router.get('/entries/{key}/{locale}/history')
def history(key:str,locale:str,user=Depends(editor),db: Session=Depends(get_db)):
    row=translation(db,key,locale)
    return [{'revision':r.revision,'snapshot':r.snapshot,'createdAt':r.created_at} for r in db.query(WebsiteRevision).filter_by(translation_id=row.id).order_by(WebsiteRevision.id.desc()).limit(30).all()]


@router.get('/media')
def list_media(user=Depends(editor),db: Session=Depends(get_db)):
    return [{'id':m.id,'filename':m.filename,'url':f'/website/media/{m.id}'} for m in db.query(WebsiteMedia.id,WebsiteMedia.filename).order_by(WebsiteMedia.id.desc()).limit(200).all()]


@router.post('/media')
def upload(data:MediaInput,user=Depends(editor),db: Session=Depends(get_db)):
    try: raw=base64.b64decode(data.data, validate=True)
    except (ValueError,binascii.Error): raise HTTPException(422,'Invalid image')
    kind = 'image/png' if raw.startswith(b'\x89PNG\r\n\x1a\n') else 'image/jpeg' if raw.startswith(b'\xff\xd8\xff') else 'image/webp' if raw[:4]==b'RIFF' and raw[8:12]==b'WEBP' else None
    if not kind or len(raw)>5*1024*1024: raise HTTPException(422,'Upload PNG, JPEG or WebP, up to 5 MB')
    media=WebsiteMedia(filename=data.filename,content_type=kind,data=raw); db.add(media); commit(db)
    return {'id':media.id,'filename':media.filename,'url':f'/website/media/{media.id}'}


@router.get('/media/{media_id}')
def read_media(media_id:int,db: Session=Depends(get_db)):
    media=db.get(WebsiteMedia,media_id)
    if not media: raise HTTPException(404,'Image not found')
    return Response(media.data,media_type=media.content_type,headers={'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=86400'})


def public_entry(e, row):
    return {'key':e.key,'kind':e.kind,**copy.deepcopy(row.published),'publishedAt':row.published_at}


@router.get('/public')
def public_index(locale:str='en',db: Session=Depends(get_db)):
    return [public_entry(e,t) for e,t in db.query(WebsiteEntry,WebsiteTranslation).join(WebsiteTranslation).filter(WebsiteTranslation.locale==locale,WebsiteTranslation.published_slug.isnot(None)).order_by(WebsiteTranslation.published_at.desc()).all()]


@router.get('/public/home/{locale}')
def public_home(locale:str,db: Session=Depends(get_db)):
    e= db.query(WebsiteEntry).filter_by(key='home').first()
    t=db.query(WebsiteTranslation).filter_by(entry_id=e.id,locale=locale).first() if e else None
    if not t or not t.published: raise HTTPException(404,'No published homepage in this language')
    return public_entry(e,t)


@router.get('/public/resolve/{locale}/{slug}')
def resolve_public(locale:str,slug:str,db: Session=Depends(get_db)):
    row=db.query(WebsiteTranslation).filter_by(locale=locale,published_slug=slug).first()
    if not row or not row.published: raise HTTPException(404,'Published page not found')
    return public_entry(db.get(WebsiteEntry,row.entry_id),row)


@router.get('/public/{key}/{locale}')
def public_page(key:str,locale:str,db: Session=Depends(get_db)):
    e=entry(db,key); t=db.query(WebsiteTranslation).filter_by(entry_id=e.id,locale=locale).first()
    if not t or not t.published: raise HTTPException(404,'No published translation')
    return public_entry(e,t)
