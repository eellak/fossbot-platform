# Native multilingual website editor — local testing branch

Branch: `codex/multilingual-website-editor`.

Open `http://localhost:3000/website-admin` using an existing administrator
account. **Website content** also appears in the sidebar for permitted accounts,
and administrators can open it from the admin panel. No separate CMS account,
service, paid plan or new frontend dependency is required.

## Editing and publishing

1. Choose **Landing page**, **Page**, or **News post**, then **Create**.
2. Choose English or Greek; **Add language** accepts additional locale codes
   such as `fr` or `de`. Public interface labels currently support English/Greek.
3. Set a title, URL slug, description and ordered sections: banner, rich text,
   image, cards, button. Move sections up/down and add/remove them. Slugs use
   lowercase Latin letters, numbers and hyphens; URLs are unique per locale.
4. **Save draft** and **Preview**. Preview uses the public content renderer but
   stays inside the authenticated editor, so no private preview URL is exposed.
5. **Publish translation** publishes the saved snapshot for this language only.
   Later draft edits leave the live snapshot and URL unchanged. Save before
   publishing. **Unpublish translation** preserves the draft.
6. **Revision history** lists the last 30 saved versions. **Load as draft**
   restores content into the editor; explicitly save and publish afterward.

A landing-page draft begins with a starter banner and introductory text taken
from the existing interface translations. Publishing replaces the main landing
content for that language with the chosen sections, retaining the shared
header/footer. The original React landing page remains the fallback when no
homepage translation is published; it has not been automatically overwritten.

Published pages use `/pages/{locale}/{slug}`; news posts use
`/news/{locale}/{slug}`, with `/news` listing posts in the selected interface
language. Published subpages appear in the public website navigation. Switching
language on a public detail page selects the corresponding published translation;
if none exists, the UI reports that it is unavailable rather than exposing drafts.

## Access and media

- Administrators always have full CMS access and can manage **Access permissions**.
- Editors can edit shared content, upload images, publish and unpublish.
- Contributors can edit shared drafts and upload images, but cannot publish.
- Accounts without a CMS grant cannot access editing endpoints. Teaching roles
  do not automatically grant CMS access. Inactive/revoked accounts are denied.

The media library accepts PNG, JPEG and WebP up to 5 MB. Images are stored in the
database so they survive rebuilds and are included in database backups. Alt text
belongs to each translated image section. Uploaded website media is publicly
addressable; the media library is not private document storage. SVG/HTML uploads
and executable link schemes are rejected. Rich text is rendered through the
existing structured React renderer, never arbitrary HTML.

## Local runtime and branch isolation

The feature adds five independent tables (`website_*`) through the existing
`Base.metadata.create_all` startup path. No existing account role, course or
robot schema is changed. Switching back to `master` hides the feature while
retaining these extra local tables for subsequent testing. Production was not
updated or deployed for this branch.

The frontend uses the normal local backend URL. `docker-compose-dev.yml` already
bind-mounts `back-end/routers`; older running containers may predate that mount.
For the current local test container, `routers/website.py` was copied to
`fsbt-back-local:/usr/src/app/back-end/routers/website.py` and that backend was
restarted. The other changed backend paths are already bind-mounted. Future
recreation with the current dev Compose configuration mounts the router normally.
Do not delete database volumes to test the feature.

Local browser testing created a bilingual sample page (`cms-local-demo` /
`cms-local-demo-el`) and unpublished English/Greek landing drafts. These are
local database test records, not auto-seeded application or production content.

## Validation

Backend tests cover draft privacy, immutable publication, independent languages,
CMS role assignment/revocation, publishing restrictions, optimistic edit conflicts,
URL reservations, revision history, media restrictions and inactive accounts.
Frontend tests cover structured rendering/HTML escaping and localized routing.
Browser checks exercised editing, preview, publishing and English→Greek switching.
