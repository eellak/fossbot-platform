## Database migrations

Tracked migrations live in `alembic/versions` and run automatically during backend startup after `create_all()` bootstraps a completely new database.

Create a revision from the backend directory:

```
alembic revision --autogenerate -m "Description of the migration"
```

Apply or roll back migrations manually:

```
alembic upgrade head
alembic downgrade -1
```

The legacy additive `migrate_schema()` helper remains for pre-Alembic user/project/stage columns only. New domain changes must use Alembic revisions.
