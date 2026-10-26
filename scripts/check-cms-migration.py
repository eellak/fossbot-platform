#!/usr/bin/env python3
"""Fingerprint pre-existing rows, apply CMS bootstrap to a disposable DB, verify unchanged.

DATABASE must point to an isolated restored copy; this script never resets a DB.
Require --apply-to-restored-copy to make the schema changes explicit.
"""
import argparse
import hashlib
import json
from sqlalchemy import inspect, text
from database import database as models


def fingerprint(engine, tables):
    result={}
    quote=engine.dialect.identifier_preparer.quote
    with engine.connect() as connection:
        for table in sorted(tables):
            digest=hashlib.sha256();count=0
            for row in connection.execute(text(f'SELECT to_jsonb(t)::text AS record FROM {quote(table)} t ORDER BY 1')):
                digest.update(row[0].encode());digest.update(b'\n');count+=1
            result[table]={'rows':count,'sha256':digest.hexdigest()}
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply-to-restored-copy',action='store_true',required=True)
    args=parser.parse_args()
    tables=inspect(models.engine).get_table_names()
    before=fingerprint(models.engine,tables)
    models.create_db_tables()
    models.run_tracked_migrations()
    models.migrate_schema()
    after=fingerprint(models.engine,tables)
    changed=[table for table in tables if before[table]!=after[table]]
    if changed: raise SystemExit('Existing data changed in: '+', '.join(changed))
    expected={'website_entries','website_translations','website_revisions','website_media','website_permissions','website_api_tokens'}
    assert expected.issubset(inspect(models.engine).get_table_names())
    models.create_db_tables();models.run_tracked_migrations();models.migrate_schema()
    assert after==fingerprint(models.engine,tables),'Repeated migration changed existing data'
    print(json.dumps({'existingTables':len(tables),'existingRows':sum(v['rows'] for v in before.values()),'dataPreserved':True,'repeatable':True,'tables':before},indent=2))


if __name__=='__main__':main()
