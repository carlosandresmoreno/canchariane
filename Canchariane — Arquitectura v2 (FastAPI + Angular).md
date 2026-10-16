# Canchariane — Arquitectura v2 (FastAPI + Angular)

Oct 16, 2026 · @agentx\_058

## Decisiones de arquitectura

El cambio de Firebase a FastAPI resuelve el problema más grave de la v1: la imposibilidad de garantizar que dos personas no reserven el mismo horario. Con PostgreSQL esa garantía deja de ser lógica de aplicación y pasa a ser una restricción del motor de base de datos.

### Las seis decisiones que definen el sistema

| Decisión | Elección | Por qué |
| --- | --- | --- |
| Base de datos | PostgreSQL 16 | El dominio es relacional y el solapamiento de reservas se previene con `EXCLUDE USING gist` sobre un `tstzrange`. Ninguna base NoSQL ofrece eso. |
| Backend | FastAPI + SQLAlchemy 2.0 async + Alembic | Tipado fuerte con Pydantic v2, OpenAPI generado automáticamente, y un cliente TypeScript derivado del esquema para Angular. |
| Forma del despliegue | Monolito modular | Un solo servicio con límites internos claros. Microservicios aquí solo agregan latencia y operación sin resolver nada. |
| Multi-tenancy | Tenant discriminado por columna (`club_id`) + filtro obligatorio en la capa de repositorio | Una base por club no escala operativamente. RLS de Postgres queda como refuerzo opcional en fase 2. |
| Tiempo | Todo en UTC en la base; cada club guarda su zona IANA | Las reglas de negocio se evalúan en hora local del club, nunca en la del navegador. |
| Pagos | No se implementan; el modelo y los puntos de extensión sí | Se evita deuda técnica sin construir lo que todavía no se vende. |

### Qué se gana respecto a la v1

- **Integridad real.** El doble booking se vuelve imposible, no improbable.
- **Lógica de negocio del lado del servidor.** El motor de disponibilidad deja de ser código que el cliente podría saltarse.
- **Consultas analíticas.** Ocupación, ingresos y horas pico son SQL, no agregaciones manuales sobre documentos.
- **Control de costos predecible.** Un servidor y una base, no lecturas facturadas por documento.
- **Portabilidad.** Sin dependencia de un proveedor para auth, datos ni reglas.

### Qué se pierde y cómo se compensa

- **Tiempo real automático.** Firestore empujaba cambios solo. Aquí se usa Server-Sent Events en el calendario del administrador y refresco por polling corto en el wizard público. SSE es suficiente y mucho más simple que WebSockets para este caso.
- **Autenticación lista para usar.** Hay que implementar registro, login, refresh y recuperación de contraseña. Es trabajo conocido y acotado.
- **Infraestructura que mantener.** Se mitiga desplegando en una plataforma gestionada (Railway, Render o Fly.io) con Postgres administrado.

## Topología

&#91;embedded content: topología · 4 componentes, 1 externo futuro\]

Un solo proceso FastAPI atiende la API y corre el scheduler. El navegador habla REST para todo y recibe SSE solo en el calendario del administrador. La restricción de exclusión vive en Postgres, así que ningún camino de código puede saltársela.

## Modelo de datos

El esquema gira alrededor de una idea: toda ocupación de una cancha, venga de una reserva, de un torneo o de un cierre por mantenimiento, es un intervalo de tiempo sobre esa cancha. Si se modela así, una sola restricción de exclusión evita todos los conflictos posibles.

### Tablas

| Tabla | Propósito | Campos clave |
| --- | --- | --- |
| `clubs` | Tenant raíz | `id`, `slug`, `name`, `timezone`, `address`, `phone`, `logo_url`, `is_published`, `subscription_status`, `paid_until`, `settings` (JSONB) |
| `club_members` | Relación usuario–club con rol | `user_id`, `club_id`, `role`, `is_active` |
| `users` | Cuentas | `id`, `email` (citext, único), `password_hash`, `full_name`, `phone`, `is_superadmin`, `email_verified_at` |
| `courts` | Canchas | `id`, `club_id`, `name`, `sport`, `surface`, `player_format`, `is_covered`, `has_lighting`, `is_active`, `position` |
| `business_hours` | Horario operativo semanal | `club_id`, `weekday` (0–6), `opens_at`, `closes_at`, `closes_next_day` |
| `pricing_rules` | Tarifas | `court_id`, `weekday_mask`, `start_time`, `end_time`, `price_cents`, `valid_from`, `valid_to` |
| `blocks` | Cierres, torneos, mantenimiento | `id`, `club_id`, `court_id` (NULL = todo el club), `period` (tstzrange), `kind`, `reason` |
| `bookings` | Reservas y holds | `id`, `code`, `club_id`, `court_id`, `period` (tstzrange), `status`, `customer_*`, `price_cents`, `recurrence_id`, auditoría |
| `booking_events` | Bitácora inmutable | `booking_id`, `event_type`, `actor_id`, `payload` (JSONB), `created_at` |

### Las tres piezas que hacen correcto el diseño

**1. El intervalo como tipo nativo.** Tanto `bookings.period` como `blocks.period` son `tstzrange`. Esto permite preguntarle a Postgres directamente si dos intervalos se cruzan, con el operador `&&`, en lugar de comparar cuatro campos de hora a mano.

**2. La restricción de exclusión.** Es el corazón del sistema:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    court_id WITH =,
    period   WITH &&
  ) WHERE (status IN ('held', 'confirmed'));
```

Dos reservas activas sobre la misma cancha cuyos intervalos se crucen son rechazadas por la base de datos. No importa cuántos servidores corran en paralelo ni qué bug tenga la aplicación. La condición `WHERE` es la que permite que una reserva cancelada deje libre el espacio sin borrar el registro.

**3. El hold que expira solo.** Un `hold` es una reserva con `status = 'held'` y `expires_at` en el futuro. No hace falta un job que los limpie: un índice parcial que solo incluya holds vigentes basta, y una tarea nocturna los marca como `expired` por higiene.

### Identificadores y auditoría

- Claves primarias en **UUIDv7**. Ordenadas por tiempo como un entero, opacas como un UUID, y seguras de exponer en la API.
- `bookings.code` es un código corto legible (`CAN-7K4M2P`) para que un invitado sin cuenta pueda consultar o cancelar su reserva por teléfono.
- `booking_events` nunca se actualiza ni se borra. Es la fuente de verdad sobre qué pasó con una reserva y quién lo hizo.
- Borrado lógico (`deleted_at`) en `clubs` y `courts`. Nunca borrado físico de algo que tenga reservas históricas.

### Índices necesarios

```sql
CREATE INDEX ON bookings USING gist (court_id, period)
  WHERE status IN ('held', 'confirmed');
CREATE INDEX ON bookings (club_id, lower(period) DESC);
CREATE INDEX ON bookings (code);
CREATE INDEX ON blocks USING gist (club_id, period);
CREATE INDEX ON club_members (user_id, club_id);
CREATE UNIQUE INDEX ON clubs (slug) WHERE deleted_at IS NULL;
```

## Estructura del backend

Monolito modular en cuatro capas. La regla que lo sostiene: el dominio no importa nada de SQLAlchemy ni de FastAPI. Se puede probar el motor de disponibilidad sin levantar una base de datos.

```text
backend/
├── app/
│   ├── main.py                      # creación de la app, middlewares, routers
│   ├── config.py                    # Settings con pydantic-settings
│   ├── domain/                      # cero dependencias de framework
│   │   ├── entities/
│   │   │   ├── club.py
│   │   │   ├── court.py
│   │   │   ├── booking.py           # máquina de estados de la reserva
│   │   │   └── time_block.py
│   │   ├── value_objects/
│   │   │   ├── time_slot.py         # intervalo con aritmética propia
│   │   │   ├── money.py             # centavos + moneda, nunca float
│   │   │   └── booking_code.py
│   │   ├── services/
│   │   │   └── availability.py      # función pura: el núcleo del negocio
│   │   └── exceptions.py            # errores de dominio, sin HTTP
│   ├── application/                 # casos de uso, orquestación
│   │   ├── use_cases/
│   │   │   ├── create_booking.py
│   │   │   ├── confirm_booking.py
│   │   │   ├── cancel_booking.py
│   │   │   ├── get_availability.py
│   │   │   └── toggle_club_status.py
│   │   ├── dto/
│   │   └── ports/                   # interfaces que la infraestructura implementa
│   │       ├── repositories.py
│   │       ├── notifier.py
│   │       └── payment_gateway.py   # definido, sin implementación real
│   ├── infrastructure/
│   │   ├── db/
│   │   │   ├── session.py
│   │   │   ├── models/              # modelos SQLAlchemy
│   │   │   ├── repositories/        # implementan los ports
│   │   │   └── migrations/          # Alembic
│   │   ├── security/
│   │   │   ├── jwt.py
│   │   │   ├── password.py          # Argon2id
│   │   │   └── rate_limit.py
│   │   ├── notifications/
│   │   │   ├── email_smtp.py
│   │   │   └── noop.py              # usado en tests y desarrollo
│   │   └── payments/
│   │       └── noop_gateway.py      # placeholder explícito
│   ├── api/
│   │   ├── deps.py                  # dependencias: usuario actual, club actual
│   │   ├── errors.py                # dominio → RFC 9457 Problem Details
│   │   └── v1/
│   │       ├── router.py
│   │       ├── auth.py
│   │       ├── public.py            # catálogo, disponibilidad, reservar
│   │       ├── bookings.py
│   │       ├── club_admin.py
│   │       └── superadmin.py
│   └── workers/
│       ├── scheduler.py             # APScheduler dentro del proceso
│       └── jobs/
│           ├── expire_holds.py
│           └── send_reminders.py
├── tests/
│   ├── unit/                        # dominio puro, sin IO
│   ├── integration/                 # repositorios contra Postgres real
│   └── e2e/                         # httpx AsyncClient sobre la app completa
├── alembic.ini
├── pyproject.toml
└── docker-compose.yml
```

### Convenciones que conviene fijar desde el inicio

- **Un caso de uso, una transacción.** El `async with session.begin()` vive en el caso de uso, nunca dentro de un repositorio.
- **Los repositorios reciben siempre el `club_id`.** No existe un método que pueda consultar reservas sin filtro de tenant. Es la barrera que impide una fuga entre clubes por descuido.
- **Errores de dominio, no `HTTPException` en la lógica.** El dominio lanza `SlotUnavailableError`; un manejador en `api/errors.py` lo traduce a un 409 con cuerpo RFC 9457. Así el dominio sigue siendo testeable sin FastAPI.
- **Pydantic v2 con esquemas separados por dirección.** `BookingCreate`, `BookingRead`, `BookingAdminRead`. Nunca el mismo esquema para entrada y salida: así no se filtran campos internos.
- **`ruff` + `mypy --strict` en CI.** Sin excepciones en `app/domain`.

## Autenticación, roles y aislamiento

El rol no vive en el usuario. Vive en la relación entre un usuario y un club. Esto permite que una misma persona administre dos sedes, o que sea dueña de un club y clienta de otro, sin modelos duplicados.

### Actores y permisos

| Actor | Cómo se identifica | Puede |
| --- | --- | --- |
| Invitado | Sin token; aporta nombre, teléfono y correo | Ver catálogo y disponibilidad, crear una reserva, consultar y cancelar la suya con el código |
| Cliente registrado | JWT de acceso | Lo anterior, más historial de reservas y reserva en un paso |
| Staff de club | JWT + membresía con rol `staff` | Ver el calendario, crear reservas manuales, marcar asistencia |
| Administrador de club | JWT + membresía con rol `admin` | Todo lo del staff, más canchas, horarios, bloqueos, tarifas y reportes |
| Superadministrador | JWT con `is_superadmin` | CRUD de clubes, estado de suscripción, métricas globales |

### Mecánica de tokens

- **Access token JWT**, 15 minutos, con `sub`, `is_superadmin` y `memberships` como lista de pares `club_id:role`. Se envía en el header `Authorization`.
- **Refresh token** opaco, 30 días, guardado hasheado en base de datos, en cookie `HttpOnly` + `Secure` + `SameSite=Lax`. Se rota en cada uso y se detecta reutilización: si llega un refresh ya consumido, se invalida toda la familia de tokens de esa sesión.
- **Contraseñas con Argon2id**, nunca bcrypt por defecto ni nada con SHA.
- **Revocación**: cerrar sesión borra el refresh; cambiar contraseña invalida todas las sesiones activas.

### Aislamiento entre clubes

Tres capas, y las tres deben estar:

1. **Ruta.** Todo endpoint administrativo cuelga de `/clubs/{club_id}/...`. El tenant es explícito en la URL, no implícito en el token.
2. **Dependencia.** `require_club_role("admin")` resuelve el `club_id` de la ruta, verifica que exista una membresía con ese rol en el token, y devuelve un contexto. Un 404 (no un 403) cuando no hay membresía, para no revelar qué clubes existen.
3. **Repositorio.** Las firmas obligan al `club_id`. No hay forma de escribir `get_bookings()` sin pasarlo.

En fase 2, Row Level Security de Postgres con `SET LOCAL app.current_club` agrega una cuarta capa, por si alguna consulta se escapa de las anteriores.

### Protección del endpoint de reserva pública

Es el único endpoint que escribe sin autenticación, así que necesita defensa propia:

- Límite por IP y por teléfono: 5 reservas por hora, 3 holds simultáneos.
- Verificación del teléfono por código de un solo uso antes de confirmar, si el club lo activa en sus `settings`. Opcional, porque agrega fricción.
- Turnstile o hCaptcha en el formulario público, invisible mientras el comportamiento sea normal.
- Los holds expirados liberan el espacio automáticamente, así que un ataque de agotamiento de slots tiene un techo de 10 minutos.

## Contrato de API

Todo bajo `/api/v1`. Errores en formato RFC 9457 (`application/problem+json`) con un campo `code` estable que el frontend puede usar para decidir, en vez de parsear mensajes.

### Endpoints públicos

| Método y ruta | Qué hace |
| --- | --- |
| `GET /clubs` | Clubes publicados y activos. Filtros por ciudad, deporte y texto. Paginado por cursor. |
| `GET /clubs/{slug}` | Ficha del club con sus canchas y horario semanal. |
| `GET /clubs/{slug}/availability?date=&sport=&duration=` | Slots disponibles del día, por cancha. El endpoint más llamado del sistema. |
| `POST /bookings/holds` | Reserva temporal de un slot. Devuelve `hold_id` y `expires_at`. |
| `POST /bookings` | Confirma el hold con los datos del cliente. Idempotente vía header `Idempotency-Key`. |
| `GET /bookings/by-code/{code}?phone=` | Consulta de un invitado sin cuenta. |
| `POST /bookings/by-code/{code}/cancel` | Cancelación de un invitado, sujeta a la política del club. |

### Autenticación

`POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `GET /auth/me`.

### Administración de club

Todo bajo `/clubs/{club_id}` y protegido por membresía.

| Método y ruta | Qué hace |
| --- | --- |
| `GET/POST/PATCH/DELETE /courts` | CRUD de canchas |
| `GET/PUT /business-hours` | Horario semanal completo, se reemplaza entero |
| `GET/POST/DELETE /blocks` | Cierres, torneos y mantenimiento |
| `GET/POST/PATCH /pricing-rules` | Tarifas por franja |
| `GET /bookings?from=&to=&court_id=&status=` | Calendario y listados |
| `POST /bookings` | Reserva manual tomada por teléfono |
| `PATCH /bookings/{id}` | Cambio de estado, reagendar, marcar no-show |
| `GET /reports/occupancy`, `/reports/revenue` | Ocupación por franja e ingresos estimados |
| `GET /events` | Server-Sent Events del calendario en vivo |

### Superadministración

`GET/POST/PATCH /admin/clubs`, `PATCH /admin/clubs/{id}/subscription`, `POST /admin/clubs/{id}/members`, `GET /admin/metrics`.

### Convenciones transversales

- **Fechas y horas en ISO 8601 con offset.** El servidor responde en UTC y además incluye `club_timezone` para que el frontend muestre la hora local correcta del club.
- **Dinero en enteros.** `price_cents` más `currency`. Nunca punto flotante.
- **Paginación por cursor**, no por offset, para que un listado no salte filas cuando entran reservas nuevas.
- **`Idempotency-Key` obligatorio** en `POST /bookings`. Evita que un doble clic o un reintento de red genere dos reservas.
- **Códigos de error estables**: `SLOT_UNAVAILABLE`, `HOLD_EXPIRED`, `CLUB_SUSPENDED`, `OUTSIDE_BUSINESS_HOURS`, `BOOKING_TOO_LATE`, `RATE_LIMITED`.
- **Cliente TypeScript generado** desde el OpenAPI de FastAPI con `openapi-typescript`. Angular nunca escribe interfaces de API a mano, así el contrato no se desincroniza.

## Motor de disponibilidad y concurrencia

Hay que separar dos problemas que suelen mezclarse. Mostrar disponibilidad es una consulta que puede estar desactualizada por unos segundos sin consecuencias. Tomar un slot es una escritura que debe ser exacta siempre. El primero se resuelve con una consulta rápida; el segundo, con una restricción de base de datos.

### Cálculo de slots

Una función pura en `domain/services/availability.py`, sin IO, que recibe todo lo que necesita y devuelve la lista de slots. Así se puede probar exhaustivamente con casos de borde.

```python
def compute_slots(
    *,
    day: date,
    tz: ZoneInfo,
    business_hours: BusinessHours | None,
    courts: Sequence[Court],
    occupied: Sequence[Interval],   # reservas activas + holds vigentes
    blocks: Sequence[Interval],     # cierres, torneos, mantenimiento
    duration: timedelta,
    step: timedelta,
    now: datetime,
    min_lead_time: timedelta,
) -> list[Slot]:
    ...
```

El orden de evaluación importa:

1. Si no hay horario operativo para ese día de la semana, el día está cerrado y se devuelve lista vacía.
2. Se genera la malla de inicios candidatos cada `step` minutos dentro del horario. Usar `step` (por ejemplo 30) distinto de `duration` (por ejemplo 60) permite que una cancha libre entre 19:30 y 20:30 aparezca, en vez de perderse por estar la malla anclada a la hora en punto.
3. Se descartan los inicios anteriores a `now + min_lead_time`. Nadie reserva para dentro de cinco minutos.
4. Por cada cancha activa se eliminan los candidatos que crucen un bloqueo o una ocupación.
5. Se adjunta el precio resolviendo la regla de tarifa vigente para esa franja.

Dos detalles que rompen implementaciones ingenuas: el cierre pasada la medianoche, que se maneja con `closes_next_day` sumando un día al límite superior; y el cambio de horario de verano, que se maneja construyendo los instantes en hora local y convirtiéndolos a UTC al final, nunca sumando segundos sobre un UTC.

### La toma del slot

El caso de uso no consulta disponibilidad antes de escribir. Intenta escribir y deja que la base decida:

```python
async def create_hold(cmd: CreateHoldCommand) -> Hold:
    async with session.begin():
        club = await clubs.get_bookable(cmd.club_id)       # 404 si suspendido
        validate_within_business_hours(club, cmd.period)
        validate_no_block(await blocks.overlapping(...))
        try:
            return await bookings.insert_hold(...)
        except IntegrityError as exc:
            if is_exclusion_violation(exc, "bookings_no_overlap"):
                raise SlotUnavailableError(cmd.period)
            raise
```

Leer antes de escribir para "verificar" no sirve: entre la lectura y la escritura cabe otra transacción. La restricción de exclusión es la única verificación que no tiene ventana. El bloque `except` que traduce la violación a un error de dominio es lo que convierte una condición de carrera en un mensaje claro para el usuario.

### Ciclo de vida de la reserva

Estados y transiciones permitidas. Cualquier transición fuera de este mapa lanza un error de dominio.

| Desde | Hacia | Quién lo dispara |
| --- | --- | --- |
| `held` | `confirmed` | Cliente completa el checkout dentro de los 10 minutos |
| `held` | `expired` | El tiempo vence; libera el slot automáticamente |
| `confirmed` | `cancelled` | Cliente dentro de la ventana, o staff en cualquier momento |
| `confirmed` | `completed` | Tarea nocturna, pasada la hora de fin |
| `confirmed` | `no_show` | Staff lo marca después de la hora de inicio |

Cada transición escribe una fila en `booking_events` con el actor y el motivo.

### Rendimiento

Una consulta de disponibilidad de un día toca tres tablas pequeñas con índices GiST. En un club de 10 canchas son decenas de filas, no miles. No hace falta caché en fase 1. Si el tráfico crece, el primer paso es cachear la respuesta de disponibilidad por `(club, fecha)` durante 15 segundos e invalidarla al escribir, no agregar más infraestructura.

## Bases para pagos futuros

El objetivo es que agregar una pasarela más adelante sea una implementación nueva, no una migración. Eso se logra dejando el modelo de datos listo y una interfaz definida, sin escribir integración real.

### Qué sí se construye ahora

- **Dinero en el modelo.** `pricing_rules` y `bookings.price_cents` desde el día uno. El precio se congela en la reserva al crearla, para que un cambio de tarifa no reescriba la historia.
- **Estado de pago separado del estado de reserva.** `payment_status` con valores `not_required`, `pending`, `paid`, `refunded`. En fase 1 todas las reservas nacen en `not_required` y el club cobra en sitio.
- **Política de depósito en `clubs.settings`.** Campos `deposit_percentage` y `payment_mode` (`on_site` | `deposit` | `full`), que en fase 1 solo toman el valor `on_site`.
- **El puerto `PaymentGateway`** en `application/ports/payment_gateway.py`, con `create_payment_intent`, `get_status` y `refund`. La única implementación es `NoopGateway`, que registra la intención y devuelve `not_required`.
- **Tabla `payments` vacía pero migrada**, con `booking_id`, `provider`, `provider_reference`, `amount_cents`, `status`, `raw_payload` (JSONB). Crear la tabla ahora cuesta nada; agregarla con 50.000 reservas vivas cuesta una migración delicada.
- **Ganchos de eventos.** `booking.confirmed` y `booking.cancelled` se publican internamente. Cuando exista la pasarela, el manejador de reembolso se suscribe sin tocar el caso de uso.

### Qué no se hace ahora

No se elige proveedor, no se escribe lógica de webhooks, no se implementa conciliación ni facturación, y no se construye UI de checkout. Elegir pasarela antes de tener clubes reales lleva a optimizar para un flujo que todavía no se conoce.

Cuando llegue el momento, en Colombia las opciones a evaluar son Wompi (de Bancolombia, con PSE nativo) y Mercado Pago. Stripe no procesa pagos locales colombianos, así que no es candidato real para este mercado.

## Frontend Angular

Se conserva lo bueno de la v1: arquitectura por features, Signals, componentes en tres archivos. Cambia la capa de datos, que ahora habla con una API propia y tipada.

```text
src/app/
├── core/
│   ├── api/
│   │   ├── generated/            # tipos desde el OpenAPI, no se editan a mano
│   │   ├── http-client.ts        # wrapper sobre HttpClient
│   │   └── endpoints/            # clubs.api.ts, bookings.api.ts, ...
│   ├── auth/
│   │   ├── auth.store.ts         # Signals: user, memberships, isLoading
│   │   ├── auth.interceptor.ts   # Bearer + refresh transparente en 401
│   │   └── guards/               # auth, role, club-active
│   ├── errors/
│   │   ├── problem-details.ts    # parseo de RFC 9457 a errores tipados
│   │   └── global-error.handler.ts
│   └── i18n/                     # es-CO: moneda COP, fechas, pluralización
├── shared/
│   ├── ui/                       # botón, modal, skeleton, toast, date-picker
│   └── utils/
└── features/
    ├── public/                   # landing, catálogo, club por slug, wizard
    ├── booking-lookup/           # consulta por código para invitados
    ├── club-admin/               # calendario, canchas, horarios, bloqueos, reportes
    └── super-admin/
```

### Estado y datos

- **Signals para estado de UI y de sesión.** `signal`, `computed`, `linkedSignal` para lo derivado del formulario del wizard.
- **`httpResource` para lecturas.** Disponibilidad, catálogo y listados se cargan declarativamente y se recargan solos cuando cambia su entrada (fecha, club, deporte). Evita el ciclo manual de `loading`, `data`, `error` en cada componente.
- **Nada de RxJS salvo donde aporta.** Un `debounceTime` en el buscador sí; un `BehaviorSubject` como store, no.
- **Zoneless change detection** y `OnPush` en todos los componentes.
- **Lazy loading por feature** con `loadChildren`, y `@defer` en el calendario del administrador, que es pesado.

### Decisiones de UX que importan más que el stack

1. **Enlace directo por club.** `/c/{slug}` cae en el calendario de ese club. Es el enlace que el club pone en su biografía de Instagram, y probablemente será el 80% del tráfico real. El catálogo general es secundario.
2. **El hold visible.** Al elegir cancha arranca un contador de 10 minutos visible. El usuario entiende que el espacio es suyo y que hay urgencia real, no artificial.
3. **Reserva de invitado en tres campos.** Nombre, teléfono, correo. Nada más. La cuenta se ofrece después de confirmar, no antes.
4. **Un solo paso para elegir hora y cancha.** La v1 los separaba en dos pasos; es un clic de más. La barra de horas y el mapa del club viven en la misma pantalla, y el wizard queda en tres pasos.
5. **El calendario del administrador es la pantalla principal**, no un dashboard de métricas. Vista semanal por cancha, arrastrar para crear una reserva manual, clic para ver detalle.
6. **Primero móvil, en serio.** La mayoría de reservas de cancha se hacen desde el celular, de noche, con una mano. Los objetivos táctiles mínimos de 44px y los slots en grilla ancha no son un detalle estético.
7. **Accesibilidad real.** Navegación por teclado en el wizard, `aria-live` cuando cambia la disponibilidad, contraste AA. Una grilla de horarios que solo funciona con mouse deja gente afuera.

### SEO

Las páginas públicas (catálogo y ficha de club) van con SSR de Angular. Es la diferencia entre aparecer o no en "canchas sintéticas cerca de mí". El área administrativa queda como SPA pura, sin SSR.

## Mapa interactivo de canchas

Un mapa de asientos de concierto y un mapa de canchas se parecen en la interacción y se diferencian en lo esencial: el asiento está libre o vendido, punto. Una cancha está libre a las 20:00 y ocupada a las 21:00. El plano es estático; lo que se pinta encima cambia con la hora elegida.

&#91;embedded content: mapa de canchas · 4 canchas, 3 estados\]

Esa diferencia manda sobre todo el diseño: la geometría se carga una vez y se cachea, el estado se recalcula cada vez que el usuario mueve la hora.

### Modelo de datos

Dos piezas nuevas. Nunca se guarda SVG crudo: solo geometría validada, que el servidor puede verificar y el cliente dibuja.

| Tabla o campo | Contenido |
| --- | --- |
| `club_layouts` | `id`, `club_id`, `name`, `level` (planta baja, segundo piso), `view_box_w`, `view_box_h`, `background_blob_id` (foto aérea opcional), `decorations` (JSONB), `is_default` |
| `courts.shape` | JSONB con la forma de la cancha dentro del plano |
| `courts.layout_id` | A qué plano pertenece; nulo si el club aún no cargó plano |

La forma es una unión discriminada, validada con Pydantic:

```json
{ "kind": "rect", "x": 120, "y": 80, "w": 300, "h": 180, "rotation": 0 }
{ "kind": "polygon", "points": [[120, 80], [420, 80], [420, 260], [120, 260]] }
```

Coordenadas en un espacio normalizado de 0 a 1000, así el plano escala a cualquier pantalla sin recalcular nada. El servidor rechaza puntos fuera del `view_box`, polígonos de más de 24 vértices y formas que se solapen entre sí. Las `decorations` (entrada, baños, cafetería, parqueadero) usan el mismo esquema con un campo `label`, y nunca son seleccionables.

### Dos endpoints, no uno

- `GET /clubs/{slug}/layout` devuelve `view_box`, decoraciones y la forma de cada cancha. Cambia casi nunca, así que va con `ETag` y `Cache-Control` largo.
- `GET /clubs/{slug}/availability?date=&start=&duration=` devuelve, por `court_id`, el estado (`free`, `booked`, `blocked`, `closed`) y el precio de esa franja.

El frontend cruza ambos. Mantenerlos separados es lo que permite repintar el mapa al mover la hora sin volver a descargar la geometría, que es el 90% del peso.

Para el administrador, `PUT /clubs/{id}/layout` reemplaza el plano completo en una transacción. Nunca ediciones parciales de geometría: es más simple de validar y evita planos a medio guardar.

### El editor del administrador

Es la parte cara, así que conviene no construir un Figma. En orden de valor:

1. **Plantillas.** Dos canchas en fila, cuatro en grilla, seis en dos filas. Cubre a la mayoría de clubes, que son rectángulos en una cuadrícula. El club escoge una plantilla, renombra las canchas y terminó.
2. **Editor de rectángulos.** Arrastrar, redimensionar y rotar, con ajuste a una grilla de 10 unidades. Suficiente para cualquier distribución irregular.
3. **Polígonos y foto de fondo.** Para canchas con forma rara o clubes que quieran su plano real debajo. Fase posterior, cuando algún club lo pida de verdad.

### Render en Angular

SVG en línea, sin librería de mapas. Un club tiene entre 2 y 20 canchas, no 20.000 asientos: el problema de rendimiento que justifica canvas o WebGL en un estadio aquí no existe.

- Un `<g>` por cancha, con su forma, su nombre y su estado. El relleno sale de un `computed()` que cruza el plano (estático) con la disponibilidad (signal que cambia con la hora).
- Pan y zoom con una matriz de transformación propia, unas cincuenta líneas. La rueda y el pellizco sobre el mismo manejador.
- En móvil, el plano ocupa la pantalla y la barra de horas queda fija abajo, al alcance del pulgar.

### Dos modos de entrada

El usuario llega con una de dos intenciones, y el mapa debe servir a ambas:

- **Tengo una hora.** Elige la franja, el mapa se pinta, toca una cancha verde.
- **Quiero esa cancha.** Toca cualquier cancha, incluso ocupada, y se abre un panel con las horas libres de esa cancha ese día.

El segundo modo es el que evita la frustración de ir probando horas a ciegas hasta encontrar la cancha que uno quería.

### Accesibilidad y degradación

- Cada cancha es un elemento enfocable con `role="button"`, `tabindex` y una etiqueta completa: *Cancha 3, pádel, disponible a las 20:00, 48.000 pesos*. El mapa se recorre entero con teclado.
- El color nunca es el único indicador: cada cancha lleva su estado escrito dentro, y las bloqueadas van con trama diagonal.
- Un club sin plano cargado muestra la lista de canchas de siempre. El mapa es una mejora progresiva, nunca un requisito para reservar.

## Calidad y operación

### Testing

Tres niveles, con énfasis muy desigual. La mayor parte del valor está en el primero.

| Nivel | Qué cubre | Herramientas |
| --- | --- | --- |
| Unitario | `compute_slots` con casos de borde: día cerrado, cierre pasada la medianoche, cambio de horario, bloqueo parcial, hold vigente, slot en el pasado | pytest + Hypothesis para generar intervalos aleatorios |
| Integración | Repositorios contra un Postgres real en contenedor, y en particular una prueba de concurrencia que lanza N peticiones simultáneas al mismo slot y verifica que exactamente una gana | pytest-asyncio + testcontainers |
| Extremo a extremo | Los dos flujos que no pueden romperse: reservar como invitado y bloquear una cancha como administrador | httpx AsyncClient, y Playwright en el frontend |

La prueba de concurrencia no es opcional. Es la que demuestra que la decisión central de la arquitectura funciona, y la que detecta si alguien debilita la restricción en una migración futura.

### Observabilidad

- Logs estructurados en JSON con `structlog`, cada petición con un `request_id` que viaja al frontend en un header.
- Sentry para errores, en backend y frontend, con el `request_id` como etiqueta para cruzar ambos lados.
- `GET /health` y `GET /health/ready`, este último verificando la conexión a la base.
- Métricas que importan desde el inicio: tasa de `SLOT_UNAVAILABLE` (si sube, el frontend está mostrando datos viejos), holds expirados sin confirmar (si sube, el checkout tiene fricción), y latencia p95 del endpoint de disponibilidad.

### CI/CD

GitHub Actions con dos trabajos. En cada pull request: `ruff`, `mypy --strict`, pytest con cobertura mínima del 80% en `app/domain`, y build de Angular. En cada merge a main: migraciones Alembic y despliegue.

### Operación

- Backups diarios automáticos con retención de 30 días, y una prueba de restauración antes de salir a producción. Un backup que nunca se restauró no es un backup.
- Migraciones siempre hacia adelante y compatibles: agregar columna nullable, desplegar código, rellenar, hacer not null en una migración posterior.
- Secretos por variable de entorno, nunca en el repositorio.
- Encabezados de seguridad: HSTS, CSP, `X-Content-Type-Options`. CORS restringido a los dominios propios.

## Roadmap

&#91;embedded content: roadmap · 4 fases, 3 criterios de salida\]

El orden importa por una razón: la fase 1 construye y demuestra el invariante del que dependen todas las demás. Si el test de concurrencia no pasa, nada de lo que venga después tiene sentido.

La fase 2 llega antes que el frontend público a propósito. Un club que ya opera su calendario en el sistema es un cliente real; una página pública bonita sin clubes adentro no sirve de nada. La forma más rápida de validar el producto es cargar un club de verdad y manejar sus reservas telefónicas desde el panel.

## Prompt de generación

El documento original pedía reglas de seguridad, motor de disponibilidad, wizard completo y módulo de cierres en una sola respuesta. Eso produce una versión superficial de cada cosa. Lo que sigue lo reemplaza: un bloque de contexto fijo que se repite en cada petición, y una fase a la vez.

### Contexto fijo

```text
Actúa como Arquitecto de Software Senior. Construimos Canchariane,
un sistema multi-tenant de reserva de canchas deportivas.

STACK (no proponer alternativas):
- Backend: Python 3.12, FastAPI, SQLAlchemy 2.0 async, Alembic,
  PostgreSQL 16 con btree_gist, Pydantic v2, pytest.
- Frontend: Angular 20 standalone, Signals, zoneless, Tailwind 4,
  SSR en rutas públicas.
- Sin pagos en esta etapa: solo el puerto PaymentGateway y NoopGateway.

INVARIANTES NO NEGOCIABLES:
1. Dos reservas activas sobre la misma cancha nunca se solapan.
   Se garantiza con EXCLUDE USING gist sobre tstzrange, no con
   lógica de aplicación.
2. Toda consulta a datos de un club recibe club_id explícito.
3. Todo instante se guarda en UTC; cada club tiene zona IANA propia.
4. El dominio (app/domain) no importa FastAPI ni SQLAlchemy.
5. El dinero son enteros de centavos más código de moneda.

FORMATO DE RESPUESTA:
- Archivos completos con su ruta, listos para pegar. Sin fragmentos
  con "...resto igual".
- Type hints completos; el código pasa mypy --strict.
- Comentarios solo donde la intención no sea evidente.
- Si una decisión queda ambigua, elígela, impleméntala y anótala
  al final en una lista de supuestos.
```

### Las fases, en orden

| Fase | Qué se pide | Criterio de aceptación |
| --- | --- | --- |
| 1 | Modelos SQLAlchemy, migración Alembic inicial con la restricción de exclusión e índices, entidades de dominio | `alembic upgrade head` corre limpio; un test inserta dos reservas solapadas y la segunda falla |
| 2 | `compute_slots` como función pura, con su suite de pruebas | Pasan los casos de borde: día cerrado, cierre a las 02:00, cambio de horario, bloqueo parcial, hold vigente |
| 3 | Autenticación: registro, login, refresh rotativo, dependencias de rol | Un administrador del club A recibe 404 al pedir datos del club B |
| 4 | Endpoints públicos: catálogo, disponibilidad, hold y confirmación con idempotencia | 20 peticiones simultáneas al mismo slot, exactamente una confirma |
| 5 | Administración de club: canchas, horarios, bloqueos, tarifas, calendario, reserva manual y editor de plano | CRUD completo con pruebas de integración |
| 6 | Superadministración y reportes de ocupación e ingresos | Las consultas corren en menos de 200 ms con 50.000 reservas sembradas |
| 7 | Angular: núcleo, autenticación, cliente generado, interceptores | El refresh en un 401 es transparente para el componente |
| 8 | Angular: wizard público de tres pasos, mapa interactivo de canchas y contador de hold | Reserva de invitado completa desde el mapa, en un celular |
| 9 | Angular: panel de club con calendario semanal y reserva manual | Crear una reserva arrastrando sobre el calendario |
| 10 | Despliegue: Docker, compose, GitHub Actions, SSR | Un `docker compose up` levanta todo el sistema |

### Una línea más en cada fase

Cerrar cada petición con esto: *"Antes de escribir código, lista en tres líneas qué decisiones vas a tomar y qué supuestos asumes. Si algo contradice una fase anterior, dilo en vez de reinterpretarlo."* Evita que el modelo cambie en silencio un nombre de tabla o un formato de fecha a mitad del proyecto.
