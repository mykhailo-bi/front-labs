# front-labs

This repository contains lab work. The backend code has been moved into [`backend/`](backend:1).

## Backend (Django REST / JSON API)

- Source: [`backend/`](backend:1)
- Backend documentation: [`backend/README.md`](backend/README.md:1)

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

### Notes

- VS Code workspace settings are in [`.vscode/settings.json`](.vscode/settings.json:1).
- Database settings are controlled via `.env` (see [`backend/.env.example`](backend/.env.example:1)).
