# BU_Psicologia — Conecta BU

Plataforma web de Bienestar Universitario (módulo Desarrollo Humano /
Orientación) de la Corporación Universitaria Autónoma del Cauca. Permite a los
estudiantes iniciar sesión con su cuenta institucional de Google y, en los
siguientes sprints, consultar servicios, agendar citas e inscribirse a eventos;
los administradores gestionan horarios, eventos, asistencia y usuarios.

## Estado actual

**Sprint 1 completo**: inicio de sesión institucional con Google, cierre de
sesión, roles (Estudiante / Administrador) y protección de rutas en frontend y
backend (historias HU-01 a HU-05).

## Tecnologías

| Capa | Stack |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router, `@react-oauth/google` |
| Backend | Node.js 18+, Express, Prisma, JWT, `google-auth-library` |
| Base de datos | PostgreSQL 16 (Docker local o Supabase) |
| Pruebas | Jest + Supertest |

## Estructura

```
conecta-bu/
├── backend/            API REST (Express + Prisma)
│   ├── prisma/         esquema, migraciones y seed
│   ├── src/modules/    un módulo por dominio (auth, admin, ...)
│   └── test/           pruebas automáticas
├── frontend/           SPA en React
│   └── src/app/        pantallas separadas por rol (estudiante/, admin/)
└── docker-compose.yml  PostgreSQL local para desarrollo
```

## Inicio rápido

```bash
cd conecta-bu
docker compose up -d                # PostgreSQL en localhost:5432

cd backend
cp .env.example .env                # completar GOOGLE_CLIENT_ID y JWT_SECRET
npm install
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
npm run dev                         # http://localhost:4000

cd ../frontend
cp .env.example .env                # completar VITE_GOOGLE_CLIENT_ID
npm install
npm run dev                         # http://localhost:5173
```

Las pruebas del backend no necesitan base de datos ni credenciales de Google:

```bash
cd conecta-bu/backend
npm test
```

La guía completa (cómo crear el Client ID de Google, cómo verificar cada
historia y qué falta para los siguientes sprints) está en
[`conecta-bu/README.md`](conecta-bu/README.md).

## Nota sobre OneDrive

Si el repositorio está dentro de una carpeta sincronizada con OneDrive, la
sincronización puede bloquear archivos de `node_modules` y provocar errores
`EPERM` al instalar dependencias. Si eso ocurre, mueve el proyecto a una
carpeta local fuera de OneDrive (por ejemplo `C:\dev\`) o pausa la
sincronización mientras trabajas.
