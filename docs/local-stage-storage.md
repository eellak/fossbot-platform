# Local stage storage

Local stages are the default persistence path. GitHub remains an optional external adapter for import, export, forking, and the external marketplace workflow.

## Storage model

`local_stages.record` and provenance fields use PostgreSQL `JSONB` (and SQLAlchemy `JSON` under the SQLite development fallback). This keeps the stage document directly in PostgreSQL; a separate document database is not needed.

An editable local stage is private and has an integer revision and SHA-256 checksum. Updates must send the revision that was opened, preventing one browser tab from silently overwriting another. Publishing creates an immutable `local_marketplace_submissions` row in `pending` state. A verifier, moderator, or administrator must approve it before `local_marketplace_publications` points to that release. Later submissions never overwrite an earlier release URL, so projects, lessons, moderation, attribution, and licenses keep referring to deterministic content.

Publication request states are `pending`, `approved`, `rejected`, `cancelled`, and `unpublished`. An approved release remains public while an update is pending. Owner unpublishing removes the listing and cancels pending requests, but approved immutable release URLs remain available to existing pinned references.

Local moderation has two distinct effects:

- **Hidden** removes the listing from discovery on this instance while existing release references continue to work.
- **Removed** quarantines the listing and blocks record, preview, copy, and republish access until a moderator restores it.

Moderation targets use the stable local publication ID rather than the editable slug. Renaming a local stage therefore cannot rename an approved release or bypass moderation.

Copies retain their immediate source and up to 20 earlier provenance records. A GitHub marketplace import records the repository, pinned commit, author metadata, and license. A later local remix retains that GitHub origin and is shown with a GitHub-source badge.

## Marketplace table retention review

The platform keeps only instance-specific marketplace state in PostgreSQL. GitHub remains the source of truth for GitHub-hosted listings and review pull requests.

| Table | Retain? | Active workflow |
| --- | --- | --- |
| `local_stages` | Yes | Editable account-local stage documents, revision checks, and project/lesson references. |
| `local_marketplace_publications` | Yes | Stable local publication channels and their current approved-release pointer. |
| `local_marketplace_submissions` | Yes | Immutable pending, approved, rejected, cancelled, and unpublished release snapshots. |
| `marketplace_role_assignments` | Yes | Admin-assigned verifier and moderator access. |
| `marketplace_reports` | Yes | Private reports from marketplace users through moderator resolution. |
| `marketplace_moderation_overrides` | Yes | Instance-local hide/remove/restore decisions for both local and GitHub entries. |
| `marketplace_moderation_actions` | Yes | Audit history for those moderator decisions and linked reports. |
| `marketplace_verification_requests` | Yes | Publisher requests and their GitHub review-PR tracking; the verified badge itself remains in the GitHub entry. |

No `marketplace_*` table duplicates the public GitHub marketplace index or source stage JSON. Retention is therefore limited to local workflow state, moderation/audit records, and user role assignments. Local-stage rows and publication snapshots remain while referenced by a project, lesson, active publication, or moderation record; any future purge job must preserve those references and the required audit retention period.

The schema is tracked by Alembic revision `20260731_07`. The migration is idempotent because application startup still calls SQLAlchemy `create_all` for compatibility with existing installations; a direct Alembic upgrade also creates the local tables and adds the source-identity columns required by shared moderation.

## Payload measurements

Measured from the public `jgenc` stage repositories on 2026-07-15:

| Repository | Pretty JSON | Compact JSON | gzip |
| --- | ---: | ---: | ---: |
| `fossbot-demo` | 26,201 B | 14,402 B | 3,220 B |
| `fossbot-untitled-stage` | 4,580 B | 2,530 B | 1,146 B |
| `fossbot-untitled-stage-2` | 4,437 B | 2,471 B | 1,099 B |

The database records a compact byte count for capacity planning. PostgreSQL `JSONB` has its own structural overhead and TOAST compression, so exact on-disk size depends on the PostgreSQL version and values; the compact byte count is a stable application-payload metric, not an exact disk measurement.

Authenticated users can inspect their current application payload totals at `GET /api/local-stages/storage`. It reports editable JSON, publication snapshots, provenance, and decoded preview bytes separately; row, index, and PostgreSQL page overhead are explicitly excluded.

For an exact PostgreSQL measurement after deployment, use:

```sql
SELECT count(*) AS stages,
       sum(pg_column_size(record)) AS jsonb_bytes,
       sum(pg_column_size(provenance)) FILTER (WHERE provenance IS NOT NULL) AS provenance_jsonb_bytes
FROM local_stages;

SELECT count(*) AS submissions,
       sum(pg_column_size(record_snapshot)) AS snapshot_jsonb_bytes,
       sum(pg_column_size(provenance_snapshot)) FILTER (WHERE provenance_snapshot IS NOT NULL) AS provenance_jsonb_bytes,
       sum(octet_length(preview_image)) AS preview_bytes
FROM local_marketplace_submissions;

SELECT pg_total_relation_size('local_stages')
     + pg_total_relation_size('local_marketplace_publications')
     + pg_total_relation_size('local_marketplace_submissions') AS tables_and_indexes_bytes;
```

At the measured median (2,530 B compact), 10,000 editable stages contain about 24.1 MiB of JSON. If every stage has one submitted release, immutable snapshots add another 24.1 MiB, before row/index overhead. Each later publication request adds another immutable snapshot. At the measured maximum (14,402 B), 10,000 editable documents plus one release each use about 137.3 MiB for each set before row/index overhead.

## Limits

- Stage JSON: 512 KiB, roughly 20 times the largest measured pretty-printed stage.
- Preview PNG: 512 KiB, decoded into binary storage rather than base64 inside JSON.
- Tags: 8 tags, 32 characters each.
- Custom `model` entries (OBJ, STL, GLB): rejected for local storage in this version.
- Embedded `data:` and temporary `blob:` values in asset fields: rejected.
- Remote GitHub imports are pinned to the marketplace commit and subject to the same validation and size limits.

PostgreSQL documents a 1 GB maximum field size, with oversized values moved out-of-line and compressed by TOAST. The application limits are deliberately far below that database ceiling: they bound request memory, backups, marketplace snapshots, and accidental asset embedding while leaving substantial room for ordinary stage growth. See the PostgreSQL [limits](https://www.postgresql.org/docs/current/limits.html) and [TOAST](https://www.postgresql.org/docs/current/storage-toast.html) documentation.

Set `FOSSBOT_BACKEND_URL` to the browser-reachable backend origin in deployed environments. It defaults to `http://localhost:8000` for local development and is used for public local-stage record and preview URLs.
