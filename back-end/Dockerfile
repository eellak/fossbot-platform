FROM python:3.12-trixie AS wheels

COPY requirements.txt /tmp/requirements.txt
# psycopg2 needs the PostgreSQL headers and compiler in the full build image.
RUN pip wheel --no-cache-dir --wheel-dir=/wheels -r /tmp/requirements.txt

FROM python:3.12-slim-trixie

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir --upgrade pip==26.3

WORKDIR /usr/src/app/back-end
COPY requirements.txt .
RUN --mount=type=bind,from=wheels,source=/wheels,target=/wheels \
    pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt

COPY main.py .
COPY alembic.ini .
COPY logging.json .
COPY alembic/ ./alembic/
COPY database/ ./database/
COPY models/ ./models/
COPY routers/ ./routers/
COPY utils/ ./utils/

# Run app.py when the container launches. Set BACKEND_RELOAD=true for local hot reload.
CMD ["sh", "-c", "if [ \"$BACKEND_RELOAD\" = \"true\" ]; then exec uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --log-config logging.json --reload --reload-dir /usr/src/app/back-end; else exec uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --log-config logging.json; fi"]
