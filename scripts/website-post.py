#!/usr/bin/env python3
"""Upload website photos and create a CMS news post using a restricted API token."""
import argparse
import base64
import getpass
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api-url', default=os.environ.get('FOSSBOT_API_URL'), help='Backend base URL, including /api when behind the production gateway')
    parser.add_argument('--title', required=True)
    parser.add_argument('--slug', required=True, help='Unique lowercase URL slug in this language')
    parser.add_argument('--locale', default='en', help='Content language: en, el, etc.')
    parser.add_argument('--description', default='')
    body = parser.add_mutually_exclusive_group()
    body.add_argument('--text', default='')
    body.add_argument('--text-file', type=Path, help='UTF-8 plain text file')
    parser.add_argument('--photo', type=Path, action='append', default=[], help='PNG/JPEG/WebP up to 5 MB; repeat for multiple photos')
    parser.add_argument('--photo-alt', action='append', default=[], help='Photo description; repeat in the same order as --photo')
    parser.add_argument('--publish', action='store_true', help='Publish immediately; requires a token with publishing permission')
    args = parser.parse_args()
    parsed = urllib.parse.urlparse(args.api_url or '')
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        parser.error('--api-url must be an HTTP(S) backend base URL without credentials, query or fragment')
    if parsed.scheme != 'https' and parsed.hostname not in ('localhost', '127.0.0.1', '::1'):
        parser.error('Use HTTPS for remote API calls; HTTP is supported only on loopback for local testing')
    if len(args.photo) > 12 or len(args.photo_alt) > len(args.photo):
        parser.error('Use up to 12 photos and at most one description per photo')
    # Read/validate all local files before issuing uploads.
    try:
        text = args.text_file.read_text(encoding='utf-8') if args.text_file else args.text
        files = [(path, path.read_bytes()) for path in args.photo]
    except OSError as exc:
        parser.error(str(exc))
    for path, raw in files:
        valid = raw.startswith(b'\x89PNG\r\n\x1a\n') or raw.startswith(b'\xff\xd8\xff') or (raw[:4] == b'RIFF' and raw[8:12] == b'WEBP')
        if not valid or len(raw) > 5 * 1024 * 1024:
            parser.error(f'{path.name}: use PNG/JPEG/WebP up to 5 MB')
    if not text.strip() and not files:
        parser.error('Provide text or at least one photo')
    token = os.environ.get('FOSSBOT_API_TOKEN') or getpass.getpass('Website API token: ')
    if not token.startswith('fbwp_'):
        parser.error('Use a website API token created in the administrator screen')
    base = args.api_url.rstrip('/')

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None  # Never forward a bearer credential to a redirect destination.

    opener = urllib.request.build_opener(NoRedirect())

    def call(endpoint, data):
        request = urllib.request.Request(base + '/website/api/' + endpoint,
                                         data=json.dumps(data).encode(), method='POST',
                                         headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token})
        try:
            with opener.open(request, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            try: detail = json.load(exc).get('detail', 'Request failed')
            except (ValueError, AttributeError): detail = 'Request failed'
            raise RuntimeError(f'API request failed ({exc.code}): {detail}') from None
        except urllib.error.URLError:
            raise RuntimeError('Could not reach the API server') from None

    photos = []
    for index, (path, raw) in enumerate(files):
        image = call('media', {'filename': path.name, 'data': base64.b64encode(raw).decode()})
        photos.append({'media_id': image['id'], 'alt': args.photo_alt[index] if index < len(args.photo_alt) else ''})
    sections = []
    if text.strip():
        paragraphs = [part.strip() for part in text.split('\n\n') if part.strip()]
        sections.append({'type': 'text', 'content': {'type': 'doc', 'content': [
            {'type': 'paragraph', 'content': [{'type': 'text', 'text': paragraph}]} for paragraph in paragraphs]}})
    post = call('posts', {'title': args.title, 'slug': args.slug, 'locale': args.locale,
                          'description': args.description, 'sections': sections, 'photos': photos, 'publish': args.publish})
    print(json.dumps({'key': post['key'], 'title': post['title'], 'locale': post['locale'],
                      'status': 'published' if post['published'] else 'draft', 'url': post['url']}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
