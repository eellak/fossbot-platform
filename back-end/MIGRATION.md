## How to make changes in the DB schema

1. Before you make any changes (only the first time)

```
alembic init alembic
```

2. After change the main.py or the file with the db schema

```
alembic revision --autogenerate -m "Description of the migration"
alembic upgrade head
```

3. If you are not happy with the result

```
alembic downgrade -1
```
