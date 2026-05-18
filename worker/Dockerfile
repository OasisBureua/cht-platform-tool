FROM python:3.11-slim

# System deps for psycopg2 (binary wheel works, but include build tooling for safety)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       gcc \
       libpq-dev \
       curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (better layer caching)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY . .

# Don't run as root
RUN useradd --create-home --shell /bin/bash worker \
    && chown -R worker:worker /app
USER worker

# Worker is a long-running process consuming SQS queues
CMD ["python", "start_workers.py"]
