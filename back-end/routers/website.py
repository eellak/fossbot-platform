"""Small native website CMS. Public endpoints expose immutable published snapshots only."""
import base64
import binascii
import copy
import datetime
import json
import hashlib
import secrets
import re
import uuid
import os
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response, Header
from pydantic import BaseModel, Field
from sqlalchemy import func, text as sql_text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from database.database import User, WebsiteEntry, WebsiteTranslation, WebsiteRevision, WebsitePermission, WebsiteMedia, WebsiteApiToken
from utils.website_images import normalize_website_image
from models.models import UserRole
from routers.stage_sources import get_db, get_current_user

router = APIRouter(prefix='/website', tags=['Website'])
LOCALE = re.compile(r'^[a-z]{2,3}(?:-[A-Z]{2})?$')
MEDIA_STORAGE_LIMIT_BYTES = max(1,int(os.getenv('WEBSITE_MEDIA_STORAGE_LIMIT_MB','512'))) * 1024 * 1024
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
        if section.get('type') not in ('banner', 'text', 'image', 'cards', 'button', 'landing', 'feature', 'people', 'testimonials', 'latest-posts', 'projects'):
            raise HTTPException(422, 'Unknown page section')
        if section.get('type') == 'landing':
            if section.get('group') not in ('navigation', 'hero', 'about', 'features', 'cta', 'footer'):
                raise HTTPException(422, 'Unknown landing section')
            values = section.get('values', {})
            if not isinstance(values, dict) or len(values) > 100:
                raise HTTPException(422, 'Invalid landing fields')
            for name, value in values.items():
                if not isinstance(name, str) or not isinstance(value, str) or len(name) > 120 or len(value) > 10000:
                    raise HTTPException(422, 'Invalid landing text')
                if name.startswith('href:'):
                    safe_url(value)
                if name.startswith('image:') and not re.fullmatch(r'(?:/website/media/[0-9]+|/landing-media/[a-zA-Z0-9_./-]+\.(?:png|jpg|jpeg|webp))', value):
                    raise HTTPException(422, 'Choose a bundled or uploaded website image')
            menu = section.get('menu', [])
            if not isinstance(menu, list) or len(menu) > 12:
                raise HTTPException(422, 'Use up to 12 menu links')
            for item in menu:
                if not isinstance(item, dict) or not isinstance(item.get('title'), str) or len(item['title']) > 200 or not isinstance(item.get('href'), str):
                    raise HTTPException(422, 'Invalid menu link')
                safe_url(item['href'])
                if 'icon' in item and (not isinstance(item['icon'], str) or not re.fullmatch(r'[a-z0-9-]{0,48}', item['icon'])):
                    raise HTTPException(422, 'Invalid menu icon')
                if item.get('linkType', 'url') not in ('cms', 'url'):
                    raise HTTPException(422, 'Invalid menu destination type')
                if item.get('linkType') == 'cms' and not re.fullmatch(r'/(?:landing-page|(?:pages|news)/[a-z]{2,3}(?:-[A-Z]{2})?/[a-z0-9]+(?:-[a-z0-9]+)*)', item['href']):
                    raise HTTPException(422, 'Choose a CMS page destination')
        for key in ('title', 'text', 'alt', 'buttonLabel', 'fundingText'):
            if key in section and (not isinstance(section[key], str) or len(section[key]) > 10000):
                raise HTTPException(422, 'Invalid section text')
        safe_url(section.get('href'))
        if section.get('type')=='projects' and 'image' in section and not isinstance(section['image'],str):
            raise HTTPException(422, 'Choose an uploaded or bundled funding image')
        if section.get('type') == 'feature' and section.get('layout', 'image-right') not in ('image-left', 'image-right'):
            raise HTTPException(422, 'Invalid image position')
        if section.get('image') and not (section.get('type') in ('feature','projects') and re.fullmatch(r'/landing-media/[a-zA-Z0-9_./-]+\.(?:png|jpg|jpeg|webp)', str(section['image']))) and not re.fullmatch(r'/website/media/[0-9]+', str(section['image'])):
            raise HTTPException(422, 'Choose an uploaded website image')
        if section.get('type') in ('cards', 'feature', 'people', 'testimonials', 'projects'):
            cards = section.get('cards', [])
            if not isinstance(cards, list) or len(cards) > 12:
                raise HTTPException(422, 'Use up to 12 cards')
            for card in cards:
                if not isinstance(card, dict) or not isinstance(card.get('title', ''), str) or not isinstance(card.get('text', ''), str):
                    raise HTTPException(422, 'Invalid card')
                if len(card.get('title', '')) > 10000 or len(card.get('text', '')) > 10000: raise HTTPException(422, 'Card text is too long')
                for field in ('role', 'organization', 'alt'):
                    if field in card and (not isinstance(card[field], str) or len(card[field]) > 10000):
                        raise HTTPException(422, 'Invalid person or testimonial text')
                if 'image' in card and (not isinstance(card['image'], str) or card['image'] and not re.fullmatch(r'/website/media/[0-9]+', card['image']) and not (section.get('type')=='projects' and re.fullmatch(r'/landing-media/[a-zA-Z0-9_./-]+\.(?:png|jpg|jpeg|webp)',card['image']))):
                    raise HTTPException(422, 'Choose an uploaded photo')
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
    if not value or value.deleted_at: raise HTTPException(404, 'Page not found')
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
def list_entries(trashed:bool=False, user=Depends(editor), db: Session=Depends(get_db)):
    return [{'key':e.key,'kind':e.kind,'translations':[draft(t) for t in db.query(WebsiteTranslation).filter_by(entry_id=e.id).order_by(WebsiteTranslation.locale).all()]} for e in db.query(WebsiteEntry).filter(WebsiteEntry.deleted_at.isnot(None) if trashed else WebsiteEntry.deleted_at.is_(None)).order_by(WebsiteEntry.id.desc()).all()]


def media_references(value):
    if isinstance(value, str):
        match=re.fullmatch(r'/website/media/(\d+)', value)
        return {int(match.group(1))} if match else set()
    children=value.values() if isinstance(value, dict) else value if isinstance(value, list) else []
    return set().union(*(media_references(child) for child in children))


def require_active_media(db, sections):
    for media_id in sorted(media_references(sections)):
        media=db.query(WebsiteMedia).filter_by(id=media_id).with_for_update().first()
        if not media or media.deleted_at:
            raise HTTPException(409, 'A photo is missing or in Trash. Restore it or remove it from the content before saving.')


@router.delete('/entries/{key}')
def trash_entry(key:str, user=Depends(editor), db:Session=Depends(get_db)):
    publisher(user, db)
    parent=entry(db,key)
    if parent.kind=='home': raise HTTPException(409, 'The homepage cannot be deleted. Unpublish its translations instead.')
    parent.deleted_at=datetime.datetime.utcnow();commit(db)
    return {'ok':True}


@router.post('/entries/{key}/restore')
def restore_entry(key:str, user=Depends(editor), db:Session=Depends(get_db)):
    publisher(user,db)
    parent=db.query(WebsiteEntry).filter_by(key=key).first()
    if not parent: raise HTTPException(404, 'Page not found')
    for row in db.query(WebsiteTranslation).filter_by(entry_id=parent.id).all():
        require_active_media(db,[row.sections,row.published])
    parent.deleted_at=None;commit(db)
    return {'ok':True}


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
    require_active_media(db,data.sections)
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
    require_active_media(db,row.sections)
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
def list_media(trashed:bool=False,user=Depends(editor),db: Session=Depends(get_db)):
    return [{'id':m.id,'filename':m.filename,'url':f'/website/media/{m.id}'} for m in db.query(WebsiteMedia.id,WebsiteMedia.filename).filter(WebsiteMedia.deleted_at.isnot(None) if trashed else WebsiteMedia.deleted_at.is_(None)).order_by(WebsiteMedia.id.desc()).limit(200).all()]


@router.post('/media')
def upload(data:MediaInput,user=Depends(editor),db: Session=Depends(get_db)):
    try: raw=base64.b64decode(data.data, validate=True)
    except (ValueError,binascii.Error): raise HTTPException(422,'Invalid image')
    raw,kind=normalize_website_image(raw)
    if db.bind.dialect.name=='postgresql':
        db.execute(sql_text('SELECT pg_advisory_xact_lock(70917103)'))
    used=db.query(func.coalesce(func.sum(func.length(WebsiteMedia.data)),0)).scalar()
    if used+len(raw)>MEDIA_STORAGE_LIMIT_BYTES:
        raise HTTPException(507,'Website media storage limit reached. Ask an administrator to review storage.')
    media=WebsiteMedia(filename=data.filename,content_type=kind,data=raw); db.add(media); commit(db)
    return {'id':media.id,'filename':media.filename,'url':f'/website/media/{media.id}'}


@router.delete('/media/{media_id}')
def trash_media(media_id:int,user=Depends(editor),db:Session=Depends(get_db)):
    publisher(user,db)
    media=db.query(WebsiteMedia).filter_by(id=media_id).with_for_update().first()
    if not media: raise HTTPException(404, 'Image not found')
    used=[]
    for row in db.query(WebsiteTranslation).join(WebsiteEntry).filter(WebsiteEntry.deleted_at.is_(None)).all():
        if media_id in media_references([row.sections,row.published]): used.append(f'{row.title} ({row.locale})')
    if used: raise HTTPException(409, 'Photo is used by: '+', '.join(used[:10])+'. Remove it from drafts and published content first.')
    media.deleted_at=datetime.datetime.utcnow();commit(db)
    return {'ok':True}


@router.post('/media/{media_id}/restore')
def restore_media(media_id:int,user=Depends(editor),db:Session=Depends(get_db)):
    publisher(user,db)
    media=db.query(WebsiteMedia).filter_by(id=media_id).with_for_update().first()
    if not media: raise HTTPException(404, 'Image not found')
    media.deleted_at=None;commit(db)
    return {'ok':True}


@router.get('/media/{media_id}')
def read_media(media_id:int,db: Session=Depends(get_db)):
    media=db.get(WebsiteMedia,media_id)
    if not media or media.deleted_at: raise HTTPException(404,'Image not found')
    return Response(media.data,media_type=media.content_type,headers={'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=86400'})


def public_entry(e, row):
    if e.deleted_at: raise HTTPException(404, 'Published page not found')
    return {'key':e.key,'kind':e.kind,**copy.deepcopy(row.published),'publishedAt':row.published_at}


@router.get('/public')
def public_index(locale:str='en',db: Session=Depends(get_db)):
    return [public_entry(e,t) for e,t in db.query(WebsiteEntry,WebsiteTranslation).join(WebsiteTranslation).filter(WebsiteEntry.deleted_at.is_(None),WebsiteTranslation.locale==locale,WebsiteTranslation.published_slug.isnot(None)).order_by(WebsiteTranslation.published_at.desc()).all()]


def post_thumbnail(sections):
    for section in sections:
        candidates=[section.get('image')]
        cards=section.get('cards')
        values=section.get('values')
        if isinstance(cards,list): candidates.extend(card.get('image') for card in cards if isinstance(card,dict))
        if isinstance(values,dict): candidates.extend(value for name,value in values.items() if name.startswith('image:'))
        for image in candidates:
            if isinstance(image,str) and re.fullmatch(r'(?:/website/media/[0-9]+|/landing-media/[a-zA-Z0-9_./-]+\.(?:png|jpg|jpeg|webp))',image): return image
    return None


def post_excerpt(published):
    text=published.get('description') or ''
    if not text.strip():
        def rich_text(node):
            if not isinstance(node,dict): return ''
            if node.get('type')=='text': return node.get('text','')
            return ' '.join(rich_text(child) for child in node.get('content',[]) if isinstance(child,dict))
        for section in published.get('sections',[]):
            text=section.get('text') or rich_text(section.get('content'))
            if text.strip(): break
    text=' '.join(text.split())
    return text if len(text)<=200 else text[:200].rsplit(' ',1)[0]+'…'


@router.get('/public/posts/latest')
def latest_posts(locale:str='en',db:Session=Depends(get_db)):
    rows=db.query(WebsiteEntry,WebsiteTranslation).join(WebsiteTranslation).filter(
        WebsiteEntry.kind=='post',WebsiteEntry.deleted_at.is_(None),
        WebsiteTranslation.locale==locale,WebsiteTranslation.published_slug.isnot(None)
    ).order_by(WebsiteTranslation.published_at.desc(),WebsiteEntry.id.desc()).limit(10).all()
    return [dict(key=e.key,kind='post',locale=row.locale,title=row.published['title'],
                 description=post_excerpt(row.published),slug=row.published_slug,publishedAt=row.published_at.isoformat()+'Z' if row.published_at else None,
                 thumbnail=post_thumbnail(row.published.get('sections',[]))) for e,row in rows]


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


# Purpose-specific credentials: these are never accepted as platform login JWTs.
class ApiTokenInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    expires_in_days: int = Field(default=90, ge=1, le=365)
    allow_publish: bool = False


class ApiPostPhoto(BaseModel):
    media_id: int = Field(gt=0)
    alt: str = Field(default='', max_length=1000)


class ApiPostInput(TranslationInput):
    publish: bool = False
    photos: list[ApiPostPhoto] = Field(default_factory=list, max_length=12)


def api_token_info(row):
    return dict(id=row.id, name=row.name, prefix=row.prefix, allow_publish=row.allow_publish,
                created_at=row.created_at, expires_at=row.expires_at,
                last_used_at=row.last_used_at, revoked_at=row.revoked_at)


@router.get('/api-tokens')
def list_api_tokens(response:Response, user=Depends(editor), db:Session=Depends(get_db)):
    administrator(user, db)
    response.headers['Cache-Control']='no-store'
    return [api_token_info(row) for row in db.query(WebsiteApiToken).order_by(WebsiteApiToken.created_at.desc()).all()]


@router.post('/api-tokens')
def create_api_token(data:ApiTokenInput, response:Response, user=Depends(editor), db:Session=Depends(get_db)):
    administrator(user, db)
    if not data.name.strip(): raise HTTPException(422, 'Enter a token name')
    secret='fbwp_'+secrets.token_urlsafe(32)
    row=WebsiteApiToken(user_id=user.id, name=data.name.strip(),
                        token_hash=hashlib.sha256(secret.encode()).hexdigest(), prefix=secret[:12],
                        allow_publish=data.allow_publish,
                        expires_at=datetime.datetime.utcnow()+datetime.timedelta(days=data.expires_in_days))
    db.add(row);commit(db)
    response.headers['Cache-Control']='no-store'
    return {**api_token_info(row), 'token':secret}


@router.post('/api-tokens/{token_id}/revoke')
def revoke_api_token(token_id:int, user=Depends(editor), db:Session=Depends(get_db)):
    administrator(user, db)
    row=db.get(WebsiteApiToken,token_id)
    if not row: raise HTTPException(404, 'Token not found')
    if row.revoked_at is None:
        row.revoked_at=datetime.datetime.utcnow();commit(db)
    return api_token_info(row)


def website_api_identity(authorization:str=Header(default=''), db:Session=Depends(get_db)):
    scheme,_,secret=authorization.partition(' ')
    invalid=HTTPException(401, 'Invalid, expired or revoked website API token', headers={'WWW-Authenticate':'Bearer'})
    if scheme.lower()!='bearer' or not secret.startswith('fbwp_') or len(secret)>100: raise invalid
    row=db.query(WebsiteApiToken).filter_by(token_hash=hashlib.sha256(secret.encode()).hexdigest()).first()
    now=datetime.datetime.utcnow()
    if not row or row.revoked_at is not None or row.expires_at<=now: raise invalid
    owner=db.get(User,row.user_id)
    if not owner or not owner.activated or owner.access_revoked or owner.role!=UserRole.ADMIN: raise invalid
    row.last_used_at=now;commit(db)
    return row,owner


@router.post('/api/media')
def api_upload_media(data:MediaInput, identity=Depends(website_api_identity), db:Session=Depends(get_db)):
    return upload(data,user=identity[1],db=db)


@router.post('/api/posts', status_code=201)
def api_create_post(data:ApiPostInput, identity=Depends(website_api_identity), db:Session=Depends(get_db)):
    credential,owner=identity
    if data.publish and not credential.allow_publish: raise HTTPException(403, 'This token can create drafts only')
    if data.expectedRevision!=0: raise HTTPException(422, 'New posts must use expectedRevision 0')
    sections=copy.deepcopy(data.sections)
    for photo in data.photos:
        if not db.get(WebsiteMedia,photo.media_id): raise HTTPException(422, 'Photo not found in website media library')
        sections.append(dict(type='image',image=f'/website/media/{photo.media_id}',alt=photo.alt))
    if len(sections)>40: raise HTTPException(422,'Use up to 40 sections, including photos')
    if any(s.get('type')=='landing' and s.get('group') in ('navigation','footer') for s in sections):
        raise HTTPException(422, 'Site settings do not belong in posts')
    checked=TranslationInput(locale=data.locale,slug=data.slug,title=data.title,description=data.description,sections=sections)
    validate(checked)
    require_active_media(db,sections)
    if not sections: raise HTTPException(422,'Add post content or photos')
    # Create entry, translation and revision atomically: a URL conflict leaves no empty entry.
    parent=WebsiteEntry(key=uuid.uuid4().hex,kind='post');db.add(parent);db.flush()
    row=WebsiteTranslation(entry_id=parent.id,locale=data.locale,slug=data.slug,title=data.title.strip(),
                           description=data.description,sections=sections,revision=1)
    db.add(row)
    try: db.flush()
    except IntegrityError:
        db.rollback();raise HTTPException(409,'This URL or translation already exists')
    db.add(WebsiteRevision(translation_id=row.id,revision=1,snapshot=snapshot(row),actor_id=owner.id))
    if data.publish:
        row.published=snapshot(row);row.published_slug=row.slug;row.published_at=datetime.datetime.utcnow()
    commit(db)
    return {'key':parent.key,'kind':'post',**draft(row),
            'url':f'/news/{row.locale}/{row.slug}' if data.publish else None}
