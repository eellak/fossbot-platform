# Website publishing API

This API is part of the local CMS branch. Production requires deploying the
branch before these endpoints or tokens are available there.

## Create a token

Sign in as an existing administrator. Open **Admin panel → Website API tokens**
(or **Website content → Website API tokens**). Enter a name and lifetime of
1–365 days. Leave **Allow publishing posts immediately** unchecked for a token
that can create only drafts. Generate the token and copy it before closing the
one-time dialog. Store it on your PC, outside Git and shared files.

The server stores a SHA-256 hash of a random 256-bit credential, not its secret.
Token lists display only a prefix and metadata. Revoke a token in the same screen.
Expired/revoked tokens and tokens owned by disabled, revoked or non-admin accounts
are rejected. Credentials work only on the two website integration endpoints;
they cannot manage tokens, accounts, permissions, courses or robot control.
Normal platform login JWTs are not accepted on these integration endpoints.

## One command from your PC

The helper uses Python 3's standard library; no pip packages are needed. Set the
backend base URL: `http://localhost:8000` for local testing, or the deployed API
base such as `https://fossbot.gr/api`. Use HTTPS for remote access.

```bash
export FOSSBOT_API_URL='http://localhost:8000'
# Read without displaying the secret or placing it literally in shell history:
read -rs -p 'Website API token: ' FOSSBOT_API_TOKEN
export FOSSBOT_API_TOKEN

python3 scripts/website-post.py \
  --title 'Our robotics workshop' \
  --slug 'robotics-workshop' \
  --locale en \
  --text-file workshop.txt \
  --photo workshop.jpg \
  --photo-alt 'Students testing a robot in the workshop'

unset FOSSBOT_API_TOKEN
```

This creates a private draft visible under Website content. Add `--publish` only
when the token has publishing permission and the post should go live immediately.
Repeat `--photo` and `--photo-alt` in matching order for multiple images. Use `el`
for Greek content. Slugs must be unique in each language. Existing posts can be
edited and translated in the CMS; this integration creates new posts.

## HTTP endpoints

Both accept `Authorization: Bearer YOUR_WEBSITE_API_TOKEN` and JSON bodies.
The UI displays the correct endpoint base for the current installation.

### POST /website/api/media

```json
{"filename":"workshop.jpg","data":"BASE64_ENCODED_FILE_BYTES"}
```

Use raw base64, without a data-URL prefix. PNG, JPEG and WebP up to 5 MB are
supported. The response contains `id`, `filename` and `url`. Uploaded images are
publicly addressable website assets, including before a referencing post is
published; they are not private file storage.

### POST /website/api/posts

```json
{
  "locale": "en",
  "slug": "robotics-workshop",
  "title": "Our robotics workshop",
  "description": "Learning through experimentation.",
  "sections": [
    {
      "type": "text",
      "content": {
        "type": "doc",
        "content": [
          {"type":"paragraph","content":[{"type":"text","text":"Today we explored robotics."}]}
        ]
      }
    }
  ],
  "photos": [{"media_id":1,"alt":"Students testing a robot"}],
  "publish": false
}
```

Replace `media_id` with the uploaded photo's ID. Photos become image sections
following the supplied content. Other supported CMS sections can also be supplied
in `sections`; site-wide navigation/footer settings are not post content.

The response is HTTP 201 with the post key, draft/published data, and a relative
`url` such as `/news/en/robotics-workshop` when published (`null` for drafts).
A publishing request with a draft-only token returns 403, invalid/expired/revoked
credentials return 401, a duplicate URL returns 409, and invalid content/media
returns 422. A conflicting post request creates no empty page entry. Posts use
existing CMS revision history and publication snapshots.

## Administrator endpoints

The UI uses `GET /website/api-tokens`, `POST /website/api-tokens` (name,
expires_in_days, allow_publish) and `POST /website/api-tokens/{id}/revoke`.
These require an administrator's normal login session, never a website API token.
The raw credential is returned only by token creation, with `Cache-Control:
no-store`; there is no token-recovery endpoint.

## Upload safety and limits

Uploads are decoded as real PNG/JPEG/WebP images, verified, oriented and encoded
again from clean pixels. EXIF/metadata and appended content are not retained.
Only still images are accepted: 5 MB maximum both before and after normalization,
8192 pixels per side and 20 megapixels maximum. Two concurrent image decodes are
allowed per backend process; busy requests return 429 and can be retried.

CMS media, including recoverable Trash, has a default 512 MB storage ceiling.
`WEBSITE_MEDIA_STORAGE_LIMIT_MB` can raise this server-side limit. A full store
returns 507; deleting to Trash does not reclaim bytes. PostgreSQL serializes
quota checks to prevent concurrent uploads bypassing the ceiling.

The production nginx CMS gateway limits request bodies to 8 MB and CMS writes to
30 per minute per client IP, with a burst allowance of 20. Read-only public
page/image requests are excluded from this write limit. These settings are scoped
to `/api/website/`; they do not change other platform features.
