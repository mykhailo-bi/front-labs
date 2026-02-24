# front_labs_backend (Django JSON API)

Run all commands below from the directory that contains this file.

This repository contains a **backend-only** Django project exposing a small JSON API.

Primary API prefix is `/api/v1/`.

For backwards compatibility, the same routes are also available under `/` (temporary alias):
[`backend/backend_project/urls.py`](backend/backend_project/urls.py:1)

## Requirements

- Python **3.10+**
- PostgreSQL **13+** (or compatible)

## Setup (local)

IMPORTANT: use `uv` for Python environment + dependency management in this repo.

### Option A: using `uv` (recommended)

```bash
cd backend

# create env file
cp .env.example .env

uv venv
uv pip install -e .
uv run python manage.py migrate
  uv run python manage.py runserver
  ```

### Seed demo data

This repo includes a small seeding script that creates:

- 1 admin user
- several regular users
- several products
- several reviews (unique per user+product)
- several images (some attached to users/products/reviews)

Run it after migrations:

```bash
cd backend

# Optional: wipe previously seeded rows for the same prefix
uv run python -m demo_scripts.seed_demo_data --reset
```

Defaults:

- admin username: `demo_admin` (will be namespaced to `demo_admin` / `demo_admin`-like depending on `--prefix`)
- admin password: `admin12345`
- user password: `user12345`

Useful options:

```bash
# Customize counts / namespace / determinism
uv run python -m demo_scripts.seed_demo_data \
  --prefix demo \
  --seed 42 \
  --users 8 \
  --products 10 \
  --reviews-per-product 3 \
  --images 30 \
  --reset
```

Source: [`backend/demo_scripts/seed_demo_data.py`](backend/demo_scripts/seed_demo_data.py:1)

Optional dev tools:

```bash
uv pip install -e ".[dev]"
```

### Option B: using `venv` + `pip`

### 1) Create and activate a virtual environment

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
```

### 2) Install dependencies

```bash
python -m pip install --upgrade pip
pip install -e .
cp .env.example .env
```

Optional dev tools:

```bash
pip install -e ".[dev]"
```

### 3) Configure the database

Database settings are configured via environment variables loaded from `.env` (see `.env.example`).

At minimum, set:

- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`

Make sure PostgreSQL is running and that the configured database/user/password exist.

### 4) Run migrations

```bash
python manage.py migrate
```

### 5) Start the server

```bash
python manage.py runserver
```

The API will be available at:

- `http://127.0.0.1:8000/`

## Authentication

Reads are public.

Authentication uses **JWT Bearer tokens** (custom HS256 implementation).

Endpoints:

- `POST /auth/register/` -> creates a customer account and returns `access` + `refresh`
- `POST /auth/login/` -> returns `access` + `refresh`
- `POST /auth/refresh/` -> returns a new `access`
- `GET/PATCH /me/` -> current user profile

Provide the token header:

`Authorization: Bearer <access_token>`

## API endpoints

Base prefix: `/api/v1/` (preferred) or `/` (alias)

This backend uses Django REST Framework viewsets + router.

- `GET /users/` (list)
- `POST /users/` (create)
- `GET /users/<id>/` (retrieve)
- `PUT/PATCH /users/<id>/` (update)
- `DELETE /users/<id>/` (delete)

User orders (authenticated):

- `GET /users/<id>/orders/` -> list orders for user
  - self: allowed for any authenticated user
  - other users: admin-only

- `GET /products/`
- `POST /products/`
- `GET /products/<id>/`
- `PUT/PATCH /products/<id>/`
- `DELETE /products/<id>/`

Product reviews (public):

- `GET /products/<id>/reviews/` -> list reviews for a product

Product images (admin-only):

- `POST /products/<id>/images/set/` -> replace image associations with `{"image_ids": [...]}`

Images (admin-only):

- `GET /images/`
- `POST /images/`
- `GET /images/<id>/`
- `PUT/PATCH /images/<id>/`
- `DELETE /images/<id>/`

- `GET /orders/`
- `POST /orders/` (admin-only)
- `GET /orders/<id>/`
- `PUT/PATCH /orders/<id>/`
- `DELETE /orders/<id>/`

- `GET /reviews/`
- `POST /reviews/`
- `GET /reviews/<id>/`
- `PUT/PATCH /reviews/<id>/`
- `DELETE /reviews/<id>/`

- `GET /cart/items/`
- `POST /cart/items/`
- `GET /cart/items/<id>/`
- `PUT/PATCH /cart/items/<id>/`
- `DELETE /cart/items/<id>/`

Cart summary:

- `GET /cart/items/summary/`

Checkout:

- `POST /checkout/` -> creates an order from cart (Idempotency-Key supported)

Payment stub (admin-only):

- `POST /payments/mark-paid/` -> marks an order as paid (Idempotency-Key supported)

Reporting (admin-only):

- `GET /reports/aggregate/`

## Example requests

```bash
# List users
curl http://127.0.0.1:8000/users/

# Register
curl -H 'Content-Type: application/json' \
  -d '{"username":"john","email":"john@example.com","password":"secret123"}' \
  http://127.0.0.1:8000/auth/register/

# Login
curl -H 'Content-Type: application/json' \
  -d '{"username_or_email":"john","password":"secret123"}' \
  http://127.0.0.1:8000/auth/login/
```

## Project layout

- `manage.py` – Django management entry point
- `backend_project/` – project settings + root URLs
- `backend_app/` – models + DRF serializers + DRF API (viewsets/router)
