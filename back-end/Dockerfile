# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set the working directory in the container
WORKDIR /usr/src/app/back-end

# Install build/runtime system dependencies for psycopg2 and packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the current directory contents into the container at /usr/src/app
COPY main.py .
COPY requirements.txt .
COPY alembic.ini .
COPY logging.json .
COPY alembic/ ./alembic/
COPY database/ ./database/
COPY models/ ./models/
COPY routers/ ./routers/
COPY utils/ ./utils/

# Upgrade pip and install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Run app.py when the container launches. Set BACKEND_RELOAD=true for local hot reload.
CMD ["sh", "-c", "if [ \"$BACKEND_RELOAD\" = \"true\" ]; then exec uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --log-config logging.json --reload --reload-dir /usr/src/app/back-end; else exec uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --log-config logging.json; fi"]
