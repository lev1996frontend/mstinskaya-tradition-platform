FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . /app

# Migrations run before the app serves anything: an image that boots against a
# schema older than its code is a worse failure than one that refuses to boot.
# No --reload here — the file watcher belongs to the compose override, not to
# the image something might be deployed from.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
