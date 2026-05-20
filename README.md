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

- `POST /auth/login` — Login (email, password). Devuelve JWT.
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
| `NEXT_PUBLIC_API_URL` | URL pública del API con sufijo `/api`, p. ej. `https://api.tudominio.com/api` |
| `POSTGRES_USER` | Usuario Postgres (default: `progress`) |
| `POSTGRES_DB` | Nombre de la base (default: `progress_sheet`) |
| `WEB_PORT` | Puerto en el host para la web en pruebas locales (default: `3000`) |

`NEXT_PUBLIC_API_URL` se usa en el **build** de la imagen web: si cambias el dominio del API, hay que **reconstruir** el servicio `web`.

### Probar en local

```bash
cp .env.compose.example .env
# Editar .env: POSTGRES_PASSWORD, JWT_SECRET y NEXT_PUBLIC_API_URL

docker compose up --build
```

- Web: http://localhost:3000  
- API: http://localhost:3001 (`NEXT_PUBLIC_API_URL` debe ser `http://localhost:3001/api`)

Migraciones: el contenedor `backend` ejecuta `prisma migrate deploy` al arrancar.

Seed opcional (una vez, con el stack levantado):

```bash
docker compose exec backend sh -c "cd /app && pnpm --filter backend run db:seed"
```

Si la imagen es anterior a este cambio: `docker compose build backend && docker compose up -d backend`.

### Coolify (un solo recurso Compose)

1. Sube el repo a Git y conéctalo en Coolify.
2. **+ New Resource** → **Docker Compose** → repositorio y rama.
3. Coolify detectará `docker-compose.yml` en la raíz.
4. Define las variables del `.env.compose.example` en el panel de entorno.
5. Asigna dominios:
   - **web** → `https://app.tudominio.com` (aplicación principal)
   - **backend** → `https://api.tudominio.com` (API; health check en `/health`)
6. Asegura que `NEXT_PUBLIC_API_URL` sea `https://api.tudominio.com/api` **antes** del primer deploy (o redeploy/rebuild de `web` tras cambiarla).
7. Deploy. El volumen `postgres_data` persiste la base de datos.

#### Deploy lento o colgado en Coolify

El primer build descarga dependencias (`pnpm install`) para **backend** y **web** por separado. En VPS chicos puede tardar 15–30 min o parecer colgado en `Progress: resolved 974...`.

**Qué hacer:**

1. **Cancelá** el deploy colgado en Coolify y volvé a desplegar tras pushear los últimos Dockerfiles (usan `--filter` y no instalan Expo/mobile).
2. En Coolify → **Settings** del servidor: activá **Docker BuildKit** y subí el **timeout de deployment** (p. ej. 45–60 min para el primer build).
3. Verificá RAM libre (recomendado **≥ 2 GB** durante el build; Next.js necesita memoria).
4. El **segundo deploy** debería ser mucho más rápido gracias a la caché de pnpm (`/pnpm/store` en los Dockerfiles).
5. Si sigue fallando: desplegá una vez solo (temporalmente comentá `web` en compose, deploy backend+postgres, luego web) para no compilar ambas imágenes a la vez.

### Mobile en producción

En builds de Expo, define `EXPO_PUBLIC_API_URL` apuntando a la URL pública del API (con `/api` donde corresponda en cada pantalla; ver `packages/mobile`).
