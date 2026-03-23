# front-labs

This repository contains lab work. The backend code has been moved into [`backend/`](backend/) and the SPA frontend lives in [`frontend/`](frontend/).

## Backend (Django REST / JSON API)

- Source: [`backend/`](backend/)
- Backend documentation: [`backend/README.md`](backend/README.md)

### Quick start

From the repository root:

```bash
cd backend

# create env file
cp .env.example .env

# install + run (using uv)
uv venv
uv pip install -e .
uv run python manage.py migrate
uv run python manage.py runserver
```

The API will be available at `http://127.0.0.1:8000/`.

## Frontend (React SPA)

- Source: [`frontend/`](frontend/)
- Dev server: http://localhost:8000 (proxied to the backend API)

### Quick start

```bash
cd frontend
npm install

# start dev server
npm run dev

# lint (AirBnB 4-space rules)
npm run lint
```

By default the frontend proxies `/api` to `http://localhost:8000`. Override with `VITE_API_URL` if needed.

### Notes

- VS Code workspace settings are in [`.vscode/settings.json`](.vscode/settings.json).
- Database settings are controlled via `.env` (see [`backend/.env.example`](backend/.env.example)).
