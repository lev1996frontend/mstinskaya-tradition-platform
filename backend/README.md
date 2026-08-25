# Backend

## Install dependencies

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# or .venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

## Configure environment

Copy the example environment file and adjust values if needed:

```bash
cp .env.example .env
```

## Start Docker services

```bash
docker compose up --build
```

This starts:

- backend on http://localhost:8000
- PostgreSQL on localhost:5432

## Run migrations

```bash
cd backend
alembic upgrade head
```

## Start development server locally

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Health check

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{ "status": "ok" }
```
