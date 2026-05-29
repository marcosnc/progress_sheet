# Progress Sheet

Aplicación para seguimiento de avance de obras y proyectos de construcción. Permite definir tareas, ubicaciones y registrar avances con consultas multidimensionales y proyecciones por velocidad.

## Estructura (monorepo)

- **packages/backend** — API Node.js + TypeScript (Fastify, Prisma, PostgreSQL). Event store, motor de agregación, auth JWT, multi-tenant.
- **packages/web** — Cliente Next.js (React) para configuración y visualización.
- **packages/mobile** — Cliente Expo (React Native) para carga de avance y reportes en obra.
- **packages/shared** — Tipos y esquemas Zod compartidos.

## Requisitos

- Node.js >= 20
- pnpm
- PostgreSQL

## Configuración

1. Clonar y instalar dependencias:

```bash
pnpm install
```

2. Crear `.env` en `packages/backend`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/progress_sheet"
JWT_SECRET="cambiar-en-produccion"
```

3. Crear la base y ejecutar migraciones:

```bash
pnpm db:migrate
```

4. (Opcional) Seed con usuario de prueba:

```bash
cd packages/backend && pnpm db:seed:dev
# En Docker o tras `pnpm build`: pnpm db:seed
```

Credenciales por defecto: `admin@example.com` / `admin123`

## Desarrollo

- Backend (puerto 3001):

```bash
pnpm dev:backend
```

- Web (puerto 3000):

```bash
pnpm dev:web
```

- Mobile:

```bash
pnpm --filter mobile dev
```

Configurar en web/mobile la URL del API (por defecto `http://localhost:3001`).

## API principal

- `POST /api/auth/login` — Login (email, password). Devuelve JWT.
- `GET/POST /api/projects` — Listar y crear proyectos.
- `GET/POST /api/projects/:projectId/plans` — Planes (versionados).
- `POST /api/projects/:projectId/plans/:planId/tasks` — Tareas del plan.
- `GET/POST /api/projects/:projectId/locations` — Ubicaciones. `POST .../locations/replicate` — Crear N ubicaciones.
- `POST /api/projects/:projectId/progress` — Registrar un avance.
- `POST /api/projects/:projectId/progress/batch` — Registrar varios avances.
- `GET /api/projects/:projectId/progress` — Consultar avance (query: `groupBy=task|location|none`).
- `GET /api/projects/:projectId/progress/state` — Estado actual por (tarea, ubicación).
- `GET /api/projects/:projectId/projections/velocity` — Proyección por velocidad.

## Roles

- **Planificador**: categorías, plan de tareas, templates, dependencias.
- **Seguimiento**: registro de avance (ideal en mobile).
- **Consulta/Proyección**: reportes y proyecciones (web).

## Despliegue con Docker Compose (Coolify)

El repo incluye `docker-compose.yml` con PostgreSQL, API y web.

### Variables de entorno

Copia `.env.compose.example` a `.env` (o configúralas en Coolify → Environment Variables):

| Variable | Descripción |
|----------|-------------|
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL (obligatoria) |
| `JWT_SECRET` | Secreto para tokens JWT (obligatorio) |
| `API_BASE_URL` | URL **completa** del API con sufijo `/api`, p. ej. `http://localhost:3001/api` o `https://app.tudominio.com/api` |
| `POSTGRES_USER` | Usuario Postgres (default: `progress`) |
| `POSTGRES_DB` | Nombre de la base (default: `progress_sheet`) |
| `WEB_PORT` | Puerto en el host para la web en pruebas locales (default: `3000`) |

La web inyecta `API_BASE_URL` en el HTML en runtime (`window.__PROGRESS_SHEET_CONFIG__`). Comprobación: `curl http://localhost:3000/runtime-config`.

### Probar en local

```bash
cp .env.compose.example .env
# Editar .env: POSTGRES_PASSWORD, JWT_SECRET (API_BASE_URL=http://localhost:3001/api por defecto)

docker compose up --build
```

- Web: http://localhost:3000  
- API (desde el navegador): `API_BASE_URL` → por defecto http://localhost:3001/api

Migraciones: el contenedor `backend` ejecuta `prisma migrate deploy` al arrancar.

Seed opcional (una vez, con el stack levantado):

```bash
docker compose exec backend node /app/packages/backend/dist/seed.js
```

Build local sin saturar CPU (una imagen tras otra):

```bash
COMPOSE_PARALLEL_LIMIT=1 docker compose build
docker compose up -d
```

### Coolify (recomendado: sin compilar en el VPS)

Compilar Next.js + pnpm en un VPS chico puede llevar el CPU al 200% y colgar Coolify. **La opción recomendada es construir las imágenes en GitHub Actions y que Coolify solo las descargue.**

#### 1. GitHub Actions (build en la nube)

1. Hacé push a `main` (o `master`). El workflow `.github/workflows/docker-publish.yml` publica en GHCR:
   - `ghcr.io/TU_USUARIO/progress-sheet-backend:latest`
   - `ghcr.io/TU_USUARIO/progress-sheet-web:latest`
2. En GitHub → **Settings → Variables** (opcional): `NEXT_PUBLIC_API_URL` solo afecta el build de respaldo; en producción manda `API_BASE_URL` en Coolify.
3. Si el repo es **privado**: en GitHub → **Packages** → cada imagen → **Package settings** → permitir acceso al repo, y en Coolify configurá credenciales de **GHCR** (usuario + PAT con `read:packages`).

#### 2. Coolify (solo pull, casi sin CPU)

1. **Detené** deploys en curso y esperá a que el servidor baje el CPU (o reiniciá Coolify si la UI quedó colgada).
2. **+ New Resource** → **Docker Compose**.
3. En **Compose file** poné: `docker-compose.coolify.yml` (no el `docker-compose.yml` por defecto).
4. Variables (ver `.env.coolify.example`):

| Variable | Ejemplo |
|----------|---------|
| `POSTGRES_PASSWORD` | (obligatoria) |
| `JWT_SECRET` | (obligatorio) |
| `BACKEND_IMAGE` | `ghcr.io/tu-usuario/progress-sheet-backend:latest` |
| `WEB_IMAGE` | `ghcr.io/tu-usuario/progress-sheet-web:latest` |
| `API_BASE_URL` | `https://progress.tudominio.com/api` |

5. **Un solo dominio** (p. ej. `https://progress.tudominio.com`):
   - Servicio **web** → dominio raíz `/`
   - Servicio **backend** → mismo dominio, path **`/api`**
   - `API_BASE_URL` = URL pública completa del API (misma que vería el navegador)
6. **Deploy** — solo descarga imágenes y levanta Postgres (~segundos de CPU, no minutos de build).

Seed en producción:

```bash
docker exec -it <contenedor-backend> node /app/packages/backend/dist/seed.js
```

#### Alternativa: compilar en el servidor (no recomendado en VPS pequeños)

Usá `docker-compose.yml`, activá **BuildKit**, y antes del deploy:

```bash
COMPOSE_PARALLEL_LIMIT=1
```

En Coolify → Environment, agregá `COMPOSE_PARALLEL_LIMIT=1` si tu versión lo respeta al hacer compose. Aun así, el primer build puede tardar mucho y saturar el servidor.

### Mobile en producción

En builds de Expo, define `EXPO_PUBLIC_API_URL` apuntando a la URL pública del API (con `/api` donde corresponda en cada pantalla; ver `packages/mobile`).
