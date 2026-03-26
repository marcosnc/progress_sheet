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
cd packages/backend && pnpm db:seed
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
