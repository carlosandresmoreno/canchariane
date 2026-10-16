# Canchariane v2 (FastAPI + Angular)

Sistema multi-tenant de alto rendimiento para reserva de canchas deportivas (pádel, tenis, fútbol, etc.), diseñado bajo una arquitectura hexagonal monolítica modular con garantía de concurrencia a nivel de motor de base de datos.

---

## 1. Decisiones Arquitectónicas Principales

1. **Prevención Matemática de Doble Booking**:
   - En lugar de validaciones frágiles de tipo *read-then-write*, se utiliza PostgreSQL 16 con la extensión `btree_gist` y una restricción de exclusión estricta:
   ```sql
   ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
     EXCLUDE USING gist (
       court_id WITH =,
       period   WITH &&
     ) WHERE (status IN ('held', 'confirmed'));
   ```
   - Si dos peticiones simultáneas intentan reservar el mismo intervalo en la misma cancha, PostgreSQL rechaza atómicamente la segunda. La API traduce esta violación a un código HTTP `409 Conflict` (RFC 9457).

2. **Aislamiento Multi-Tenant (Triple Barrera)**:
   - Todo endpoint administrativo cuelga de `/clubs/{club_id}/...`.
   - Si un usuario autenticado intenta acceder a recursos de un club al que no pertenece, la API responde `404 Not Found` (nunca `403`), evitando enumerar o revelar la existencia de otros tenants.
   - Las consultas a nivel de repositorio exigen obligatoriamente `club_id`.

3. **Manejo Temporal Estricto**:
   - Todo instante se almacena en UTC (`tstzrange` con timestamp con zona horaria).
   - Cada club define su zona IANA (ej. `America/Bogota`). Las reglas operativas, horarios de apertura y cierres de madrugada (`closes_next_day`) se proyectan en la hora local del club y se transforman a UTC al persistir.

4. **Pureza de Dominio (`app/domain`)**:
   - Cero dependencias de frameworks (sin FastAPI, sin SQLAlchemy, sin Pydantic).
   - Validadas con `mypy --strict` (0 advertencias en 16 archivos) y cobertura superior al 90%.

5. **Frontend Angular 19/20 Standalone Zoneless**:
   - Change detection zoneless (`provideExperimentalZonelessChangeDetection()`).
   - Estado 100% reactivo con Signals y `computed()`.
   - Tailwind CSS v4 con paleta HSL deportiva de alta calidad.
   - Mapa interactivo de canchas SVG con Pan & Zoom táctil fluido y actualización reactiva por horario.
   - Contratos de tipos sincronizados automáticamente desde OpenAPI (`openapi.json`).

---

## 2. Estructura del Proyecto

```text
canchariane/
├── .github/workflows/ci.yml       # Pipeline CI: ruff, mypy, pytest, ng test, ng build
├── docker-compose.yml             # Orquestación Postgres 16, Backend FastAPI y Frontend NGINX
├── docker/init-db.sh              # Script de inicio para habilitar btree_gist en Postgres
├── backend/
│   ├── Dockerfile                 # Multi-stage Python 3.12-slim
│   ├── pyproject.toml             # Configuración de dependencias, ruff, mypy y pytest
│   ├── alembic.ini                # Configuración de migraciones
│   ├── app/
│   │   ├── main.py                # Fábrica de aplicación FastAPI, CORS, middlewares
│   │   ├── config.py              # Variables de entorno con pydantic-settings
│   │   ├── domain/                # Dominio puro (0 dependencias de frameworks)
│   │   │   ├── entities/          # Club, Court, Booking, BusinessHours, PricingRule
│   │   │   ├── value_objects/     # Money, BookingCode, TimeSlot, Slot
│   │   │   ├── services/          # compute_slots (algoritmo puro de disponibilidad)
│   │   │   └── exceptions.py      # Excepciones de dominio puras
│   │   ├── application/           # DTOs y puertos
│   │   ├── infrastructure/        # SQLAlchemy 2.0 Async, Argon2id, JWT, migraciones
│   │   └── api/                   # Controladores REST v1 (público, admin, superadmin, auth)
│   ├── scripts/
│   │   ├── seed_benchmark.py      # Generador de 50.000 reservas con análisis EXPLAIN ANALYZE
│   │   └── seed_demo_club.py      # Sembrador del club demo 'club-alpha' con plano SVG
│   └── tests/
│       ├── unit/                  # Tests unitarios y pruebas generativas (Hypothesis)
│       └── integration/           # Concurrencia GiST, aislamiento tenant, auth, reportes
└── frontend/
    ├── Dockerfile                 # Multi-stage Node 22 + NGINX 1.27
    ├── nginx.conf                 # Proxy inverso NGINX (/api/ -> backend:8000)
    ├── proxy.conf.json            # Proxy de desarrollo local
    └── src/app/
        ├── core/                  # AuthStore (Signals), interceptores, RFC 9457
        └── features/
            ├── public/            # Wizard de reserva 3 pasos, Mapa SVG, consulta por código
            ├── admin/             # Grilla semanal de recepción, modal de reserva, SSE en vivo
            └── auth/              # Portal de login para staff y administradores
```

---

## 3. Instrucciones de Ejecución

### Opción 1: Con Docker Compose (Recomendado para Producción)
```bash
docker compose up -d --build
```
- **Frontend**: [http://localhost:80](http://localhost:80)
- **API Backend**: [http://localhost:8000/api/v1](http://localhost:8000/api/v1)
- **Documentación OpenAPI**: [http://localhost:8000/docs](http://localhost:8000/docs)

### Opción 2: Entorno de Desarrollo Local

#### A. Base de Datos
```bash
docker compose up -d postgres
```

#### B. Backend
```bash
cd backend
source ../.venv/bin/activate
pip install -e .
alembic upgrade head
python scripts/seed_demo_club.py
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### C. Frontend
```bash
cd frontend
npm install
npm run start # Corre en http://localhost:4300 con proxy automático a FastAPI
```

---

## 4. Pruebas Automatizadas y Calidad de Código

### Backend
```bash
cd backend
# 31 tests unitarios y de integración
pytest tests/ -v

# Cobertura sobre app/domain (Meta: > 80% | Resultado: 91%)
pytest --cov=app/domain --cov-report=term-missing tests/unit/

# Tipado estricto
mypy --strict app/domain

# Linter de código
ruff check .
```

### Frontend
```bash
cd frontend
# Tests unitarios con Karma & ChromeHeadless
npm run test -- --watch=false --browsers=ChromeHeadless

# Compilación de producción optimizada
npm run build
```

---

## 5. Métricas de Rendimiento sobre 50.000 Reservas

Validado mediante `EXPLAIN (ANALYZE, BUFFERS)` en `scripts/seed_benchmark.py`:
- **Consulta de Solapamiento GiST**: p50 = 0.49 ms | p95 = 0.84 ms (Objetivo < 200 ms)
- **Cálculo de Disponibilidad de 1 Día**: p50 = 19.82 ms | p95 = 26.81 ms
- **Reporte Agregado de Ocupación (30 Días)**: p50 = 27.88 ms | p95 = 36.04 ms
- **Reporte Agregado de Ingresos (30 Días)**: p50 = 26.60 ms | p95 = 27.09 ms
- **Tasa de Inserción Masiva**: 28.408 filas/segundo
