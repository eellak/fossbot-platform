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

The landing editor includes the complete existing page: top menu, hero and partner
logos, robot/platform introduction and facts, four illustrated feature stories,
closing invitation, and footer. Text, image descriptions, media and links are
editable per language. The original React components preserve the landing design;
these native sections can be combined with extra generic content blocks. The top
menu and footer remain fixed areas. The original page is the fallback until a
home translation is published.

The old two-block starter is upgraded to the complete draft only when it exactly
matches the original starter (independent of JSON key order). Customized drafts
and published snapshots are preserved. The upgrade requires an explicit save.
English and Greek local home drafts have been saved with all six sections and
remain unpublished for user review.

Published pages use `/pages/{locale}/{slug}`; news posts use
`/news/{locale}/{slug}`, with `/news` listing posts in the selected interface
language. Add published subpage/news links explicitly under the home entry’s
**Top menu** section, then save and publish that language. Desktop and mobile
use this same menu; there is no second automatic navigation bar. Switching
language on a public detail page selects the corresponding published translation;
if none exists, the UI reports that it is unavailable rather than exposing drafts.

## Reusable page components

Every page, post and home translation has **Add component**, which opens the
searchable component library. Available blocks are banner, rich text, image,
card grid, people cards, testimonials, button and flexible text/image (image left/right, optional bullets and
link). The original hero, detailed introduction, four-story feature tour and
closing invitation are also available as editable layout presets on any page.

**Duplicate** copies a component next to the original; **Copy from a page’s
draft** imports an existing component in the same content language. Copies have
independent content and media references: editing a copy does not update its
source or other instances. These are reusable layouts/copies, not synchronized
shared content. Each original layout receives its own scoped data so repeated
instances on one page retain independent text and links. Copied images reuse the
same media asset until replaced through the image picker.

The home editor separates **Page components** from **Site-wide menu and footer**.
Global settings cannot be duplicated/imported as page content. New home content
is inserted before the fixed footer. All public subpages and their draft previews
use the shared published home menu/footer. A page retains its own title and a
single primary heading when it contains hero presets. No stored drafts or
published snapshots require migration.

## People cards and testimonials

**People cards** supports a portrait, name, role/title, organization, biography
and optional profile link per person. **Testimonials** supports a quote plus its
author’s photo, name, role, organization and optional source link. Add either from
the component library, then add/edit/reorder/remove up to 12 cards. All text and
photo descriptions belong to the selected content language.

**Choose photo** opens the existing media library, with PNG/JPEG/WebP upload;
**Remove photo** clears only that card’s portrait. People portraits use a 4:3
crop; testimonials use circular author photos. Initials appear until a real
photo is selected. New blocks begin empty. No endorsements or portraits are
invented. The local About us team blocks have been upgraded to People cards in
both languages, retaining their existing text and leaving portrait slots empty.

## Menu destinations and icons

In **Landing page → Top menu**, each item has a destination type. **CMS page or
post** searches published pages/posts in the selected content language and uses
their published URL (never an unpublished draft slug). Home is always available
because the platform has a built-in fallback landing page. **External URL /
custom path** accepts HTTPS websites and local platform paths. Labels remain
independent of page titles. If a page is unpublished or its published slug
changes, reselect its destination and republish the home menu.

**Menu icon** searches 40 bundled Tabler icons using English/Greek names and
keywords; **No icon** removes the icon. The chosen icon is stored on each item,
so reordering preserves it on desktop and mobile. Old menus without icon IDs
retain their four default partner icons by destination URL, rather than position.
No icon font, CDN, upload, or extra dependency is required.

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

## Posting from a PC with API tokens

Administrators can open **Admin panel → Website API tokens**, or the API-token
tab inside Website content. Tokens have a name, a 1–365-day lifetime, optional
publish permission and revocation. They are displayed once and stored hashed.
They work only with `POST /website/api/media` and `POST /website/api/posts`, not
normal account/robot/CMS administration routes. Posts default to private drafts.
See [Website publishing API](website-api.md) and `scripts/website-post.py --help`
for a one-command photo upload/post workflow from a PC. This adds the independent
`website_api_tokens` table through normal startup; no existing table is altered.

### Deleting content and uploads

Administrators and website editors can move pages and posts to **Trash**, from
both the content list and the editor toolbar. This removes every language from
public routes and listings. **Trash → Restore** recovers drafts, revision history
and the previous published versions (which become public again). Unsaved edits
are discarded when deleting the open entry. The homepage is protected; use
Unpublish for its translations. Trashed entries retain their URL reservations.

Open **Media library** from the page header, or while choosing an image. Each
upload has **Delete photo** and a recoverable Trash/Restore flow. Photos referenced
by saved drafts or published snapshots of active entries cannot be deleted; the
server identifies the pages using them. Remove the photo, save, and update or
unpublish the published version first. Historical revisions do not block deletion.
If a trashed page uses a trashed photo, restore the photo before restoring the
page. Restoring an old revision containing a trashed photo also requires restoring
the photo before saving. Contributors cannot delete or restore entries/uploads.
This is recoverable deletion; no permanent purge or storage reclamation is added.

API: session-authenticated DELETE `/website/entries/{key}` and
`/website/media/{id}` move items to Trash; POST the same paths plus `/restore`
recovers them. GET `/website/entries?trashed=true` and
`/website/media?trashed=true` list Trash. Purpose-specific PC bearer tokens do not
acquire deletion privileges. Additive startup migration adds nullable `deleted_at`
columns to the two existing tables.

### Latest posts component and separate post management

Pages (including the homepage) and Posts have separate CMS tabs and Trash lists.
Creating content in Posts always creates a post. Editors and contributors can
use both tabs with their existing role permissions. The Posts tab also opens
with `/website-admin?tab=posts`; the existing API token link stays supported.

Use **Add component → Latest posts** on any CMS page, including the landing page.
The section title is editable. The component shows up to 10 published posts in
the page's content language, ordered by publication time descending, with entry
ID as a stable tie-breaker. Drafts, pages and trashed posts are excluded. The
first image (including feature/profile/native image fields) in the published
article supplies the thumbnail; articles without one have a neutral news icon.
Draft changes never leak into the feed. Republish updates the publication date.

Readers click a row to load the current published article in a scrollable dialog;
closing it preserves the surrounding page. Post previews show a short description
(up to 200 characters, falling back to article text) and an inline Read more
link at the end, using the same font size as the description. Full posts show the title and article body without repeating the preview
description below the title. Missing/unpublished articles show a
message. Nested latest-post feeds are suppressed in article dialogs to avoid
recursive article viewers. The component has loading, retry and empty states,
and English/Greek labels. Lists refresh on mounting, changing language or retry.

For other React screens, import `LatestPosts` from `src/website/LatestPosts` and
render `<LatestPosts />` (interface language) or `<LatestPosts locale="el" />`.
It does not require login. `/website/public/posts/latest?locale=en` returns only
10 lightweight summaries; article content is fetched on demand through the
existing public endpoint. No component has been inserted into existing published
user pages automatically.

### Projects

Use **Add component → Projects** on the landing page or any CMS page. Each of up
to 12 project cards has a logo, name, description, optional website link and image
alternative text. Add, remove and reorder projects using the card controls. Logos
use contain sizing so their original proportions and full artwork remain visible.
Two projects fill two columns on larger screens; cards stack on small screens.
The section can also have introductory text, a shared funding image with alt
text and a funding acknowledgement below the cards. These fields are optional.

The existing image library selects/uploads project logos and the funding image.
Projects additionally support bundled `/landing-media/` PNG/JPEG/WebP assets;
other profile card image restrictions are unchanged. Uploaded logos and funding
images participate in the existing media deletion protection. Translations,
publication snapshots and reusable copying work like other components.

Canonical STEPS/FOSSBot4AI descriptions in English and Greek and official asset
sources are recorded in `docs/website-content/projects-sources.md`. Their cards
are saved in the local homepage drafts; publishing remains a separate CMS action.

### Safe production rollout

Back up production PostgreSQL first. CMS tables are additive; do not replace the
production database with a development dump. `scripts/check-cms-migration.py`
accepts `--apply-to-restored-copy` and compares fingerprints of every existing
table before/after schema bootstrap, tracked migrations and repeat execution.
Run it only against an isolated restored copy, with `PYTHONPATH=back-end` and
`DATABASE` pointing to that copy. It prints counts/hashes, never record contents.

`scripts/website-content-transfer.py --export-file FILE` exports active CMS
entries, translations, published snapshots, history and referenced images only.
The private JSON export excludes users, CMS permissions and API tokens. Import
with `--import-file FILE` into the newly bootstrapped production CMS. Import
refuses a non-empty destination and runs atomically; it never resets tables.
Media IDs/references are remapped and images normalized. Historical actor IDs
are left unset because local user IDs are not production identities. Draft and
published states remain distinct, including homepage Projects drafts.
