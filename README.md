# front-labs

This repository contains lab work split into two applications:

- `backend/` - a Django REST backend for an e-commerce-style JSON API
- `frontend/` - a React SPA that consumes the backend

## Repository layout

- `backend/` - Django project, API app, tests, and demo data scripts
- `frontend/` - React/Vite frontend

## Backend

The backend is a JSON-only Django REST API with custom JWT authentication, admin-only management endpoints, stock-aware checkout flows, OpenAPI docs, health probes, CSV import/export helpers, and a seeded demo data script.

### Backend stack

- Python 3.10+
- Django 4.2
- Django REST Framework
- `djangorestframework-simplejwt` for JWT issuance and validation
- `drf-spectacular` for OpenAPI schema and Swagger UI
- PostgreSQL via `psycopg2-binary`
- `pytest`, `pytest-django`, `ruff`, and `black` for development tooling

### Backend features

- Custom `User` model stored in `backend_app.models` instead of Django auth users
- Bearer token auth with access/refresh JWTs and token revocation support
- Product catalog with categories, product images, featured/published flags, and basic filters
- Cart, checkout, order lifecycle, reservation expiry, payment stubs, refund requests, and order timeline events
- Address book, wishlist, saved items, product reviews, and avatar/image records
- CSV import/export endpoints for users and products
- Liveness and readiness probes at `/healthz` and `/readyz`
- OpenAPI schema at `/api/schema/` and Swagger UI at `/api/docs/` when docs are enabled

### Quick start

From the repository root:

```bash
cd backend
cp .env.example .env
uv venv
uv pip install -e .[dev]
uv run python manage.py migrate
uv run python manage.py runserver 9000
```

The backend serves on `http://127.0.0.1:9000/` by default.

### Backend configuration

The backend requires environment variables from `backend/.env`. The exact template lives in `backend/.env.example`.

Important settings include:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `DB_ENGINE`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`
- `JWT_SECRET_KEY`, `JWT_ACCESS_TTL_SECONDS`, `JWT_REFRESH_TTL_SECONDS`
- `ORDER_RESERVATION_TTL_SECONDS`
- `ORDER_CURRENCY`, `ORDER_BASE_CURRENCY`, `ORDER_FX_RATE`
- `ORDER_SHIPPING_FLAT`, `ORDER_TAX_RATE`, `ORDER_DISCOUNT_RATE`
- `IMAGE_UPLOAD_MAX_BYTES`
- `SPECTACULAR_ENABLE_DOCS`

### Main backend routes

All application API routes are versioned under `http://127.0.0.1:9000/api/v1/`.

Common endpoints:

- `POST /api/v1/auth/register/`
- `POST /api/v1/auth/login/`
- `POST /api/v1/auth/refresh/`
- `POST /api/v1/auth/logout/`
- `POST /api/v1/auth/change-password/`
- `POST /api/v1/auth/password-reset/`
- `POST /api/v1/auth/password-reset/confirm/`
- `POST /api/v1/auth/email-verification/`
- `POST /api/v1/auth/email-verification/confirm/`
- `GET|PATCH /api/v1/me/`
- `POST /api/v1/checkout/`
- `POST /api/v1/payments/mark-paid/`
- `GET /api/v1/reports/aggregate/`
- REST viewsets under `/api/v1/users/`, `/api/v1/products/`, `/api/v1/orders/`, `/api/v1/categories/`, `/api/v1/reviews/`, `/api/v1/addresses/`, `/api/v1/images/`, and related resources

Operational endpoints:

- `GET /healthz`
- `GET /readyz`
- `GET /api/schema/`
- `GET /api/docs/`
- `GET /admin/`

### Backend development commands

```bash
cd backend

# run tests
uv run pytest

# run a specific test module
uv run pytest backend_app/tests/test_orders_payments.py

# lint and format
uv run ruff check .
uv run black .
```

### Seed demo data

The repository includes `backend/demo_scripts/seed_demo_data.py` for creating local sample data.

Example:

```bash
cd backend
uv run python -m demo_scripts.seed_demo_data --reset
```

The script can create:

- one admin user
- multiple regular users
- products
- reviews
- image records linked to avatars, products, and reviews

## Frontend

The frontend is a React SPA in `frontend/` and is intended to run against the Django backend during development.

### Framework and architecture

- Framework: React + TypeScript + Vite
- Routing: `react-router-dom` with routes for `/overview`, `/users`, `/products`, `/orders`, `/login`
- API integration: REST calls to backend endpoints under `/api/v1/*`
- Data exchange format: JSON (`Accept: application/json`, `Content-Type: application/json`)

### Frontend quick start

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Run lint:

```bash
npm run lint
```

The SPA runs on `http://localhost:8000`.

Vite proxies `/api` to `http://127.0.0.1:9000`, so local backend and frontend work together without CORS setup.

To override backend URL directly, create `frontend/.env`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:9000/api/v1
```

### Refresh behavior for deep links

`BrowserRouter` is used for SPA routing. Vite development server serves the SPA entry for unknown routes, so direct refresh on paths like `/users` keeps the same page visible.

### Browser support

- Google Chrome (latest stable)
- Mozilla Firefox (latest stable)

### Quality gates

- No console errors or logs during normal flow
- Linting via `npm run lint`
- Production build via `npm run build`
- Code is split into focused files/components to keep responsibilities isolated

## Notes

- Workspace editor settings live in `.vscode/settings.json`
- Root README is the high-level entry point; backend-specific implementation details may also live in `backend/README.md`
- The backend admin is restricted through a custom admin site implementation in `backend/backend_app/admin.py`
