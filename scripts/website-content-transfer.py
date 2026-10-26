#!/usr/bin/env python3
"""Transfer native CMS content only. Never copy users, permissions or API tokens.

Run with the backend's dependencies and DATABASE configured. Import is atomic
and refuses a destination containing any CMS entries or media. Existing platform
tables are never updated. Treat exported drafts as private data.
"""
import argparse
import base64
import datetime
import json
import os
from pathlib import Path
import re
import sys

backend=Path(__file__).resolve().parents[1]/'back-end'
sys.path.insert(0,str(backend if backend.is_dir() else Path.cwd()))
from sqlalchemy import text
from database.database import getSessionLocal, WebsiteEntry, WebsiteTranslation, WebsiteRevision, WebsiteMedia
from routers.website import media_references, validate, TranslationInput, snapshot
from utils.website_images import normalize_website_image


def stamp(value):return value.isoformat() if value else None

def date(value):return datetime.datetime.fromisoformat(value) if value else None


def export_content(session,path):
    entries=[];refs=set()
    for entry in session.query(WebsiteEntry).filter(WebsiteEntry.deleted_at.is_(None)).order_by(WebsiteEntry.id).all():
        translations=[]
        for row in session.query(WebsiteTranslation).filter_by(entry_id=entry.id).order_by(WebsiteTranslation.locale).all():
            history=[dict(revision=r.revision,snapshot=r.snapshot,created_at=stamp(r.created_at)) for r in session.query(WebsiteRevision).filter_by(translation_id=row.id).order_by(WebsiteRevision.id).all()]
            item=dict(**snapshot(row),published=row.published,published_slug=row.published_slug,published_at=stamp(row.published_at),updated_at=stamp(row.updated_at),history=history)
            refs.update(media_references(item));translations.append(item)
        entries.append(dict(key=entry.key,kind=entry.kind,created_at=stamp(entry.created_at),translations=translations))
    media=[]
    for media_id in sorted(refs):
        row=session.get(WebsiteMedia,media_id)
        if not row:raise RuntimeError('Referenced CMS image is missing: '+str(media_id))
        media.append(dict(id=row.id,filename=row.filename,content_type=row.content_type,data=base64.b64encode(row.data).decode(),deleted_at=stamp(row.deleted_at)))
    payload=dict(version=1,entries=entries,media=media)
    descriptor=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(descriptor,'w') as output:json.dump(payload,output,ensure_ascii=False)
    print(json.dumps(dict(exportedEntries=len(entries),exportedTranslations=sum(len(e['translations']) for e in entries),exportedImages=len(media))))


def import_content(session,path):
    payload=json.loads(Path(path).read_text())
    if payload.get('version')!=1:raise RuntimeError('Unsupported CMS export format')
    with session.begin():
        if session.bind.dialect.name=='postgresql':
            session.execute(text('LOCK TABLE website_entries, website_media IN EXCLUSIVE MODE'))
        if session.query(WebsiteEntry).count() or session.query(WebsiteMedia).count():
            raise RuntimeError('Destination CMS is not empty. Refusing to overwrite existing content.')
        image_ids={}
        for item in payload['media']:
            raw=base64.b64decode(item['data'],validate=True)
            normalized,mime=normalize_website_image(raw)
            row=WebsiteMedia(filename=item['filename'],content_type=mime,data=normalized,deleted_at=date(item['deleted_at']))
            session.add(row);session.flush();image_ids[item['id']]=row.id
        def rewrite(value):
            if isinstance(value,str):
                match=re.fullmatch(r'/website/media/(\d+)',value)
                return '/website/media/'+str(image_ids[int(match.group(1))]) if match else value
            if isinstance(value,list):return [rewrite(child) for child in value]
            if isinstance(value,dict):return {key:rewrite(child) for key,child in value.items()}
            return value
        for item in payload['entries']:
            if item['kind'] not in ('home','page','post'):raise RuntimeError('Invalid CMS entry kind')
            entry=WebsiteEntry(key=item['key'],kind=item['kind'],created_at=date(item['created_at']));session.add(entry);session.flush()
            for source in item['translations']:
                draft=rewrite(source)
                validate(TranslationInput(**{name:draft[name] for name in ('locale','slug','title','description','sections')}))
                if draft['published']:validate(TranslationInput(**draft['published']))
                row=WebsiteTranslation(entry_id=entry.id,**{name:draft[name] for name in ('locale','slug','title','description','sections','revision','published','published_slug')},published_at=date(draft['published_at']),updated_at=date(draft['updated_at']))
                session.add(row);session.flush()
                for revision in draft['history']:
                    session.add(WebsiteRevision(translation_id=row.id,revision=revision['revision'],snapshot=revision['snapshot'],actor_id=None,created_at=date(revision['created_at'])))
    print(json.dumps(dict(importedEntries=len(payload['entries']),importedTranslations=sum(len(e['translations']) for e in payload['entries']),importedImages=len(payload['media']),permissionsCopied=False,apiTokensCopied=False)))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    action=parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--export-file');action.add_argument('--import-file')
    args=parser.parse_args()
    with getSessionLocal()() as session:
        if args.export_file:export_content(session,args.export_file)
        else:import_content(session,args.import_file)


if __name__=='__main__':main()
