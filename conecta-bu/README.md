# Conecta BU — Sprint 1 (código base)

Código base del proyecto **Conecta BU** para el Sprint 1: inicio de sesión
institucional, roles y protección de rutas administrativas (historias HU-01
a HU-05 del Product Backlog). Sigue la arquitectura, el modelo de datos y el
contrato de API definidos en **F-03**.

No incluye funcionalidades de sprints futuros (citas, horarios, eventos,
n8n, IA, dashboard): esas se agregan sobre esta misma base siguiendo la
estructura de carpetas que ya está creada.

## Qué construye este código

| Historia | RF de F-02 | Qué hace |
|---|---|---|
| HU-01 | RF-001 | Inicio de sesión con la cuenta institucional de Google |
| HU-02 | RF-001 / RN-001 | Rechaza cuentas fuera del dominio institucional |
| HU-03 | RF-002 | Cierre de sesión |
| HU-04 | RF-002 | Cada rol ve solo su menú y sus rutas |
| HU-05 | RF-002 / RNF-002 / RN-008 | El backend rechaza (401/403) las peticiones administrativas sin permiso |

## 1. Requisitos previos

- Node.js 18 o superior
- Una cuenta de Google Cloud (gratuita) para crear el Client ID de OAuth
- PostgreSQL: usa el `docker-compose.yml` incluido, o una instancia gratuita
  en [Supabase](https://supabase.com) (así lo propone F-03 para desarrollo)

## 2. Crear el Client ID de Google (una sola vez)

1. Entra a [Google Cloud Console](https://console.cloud.google.com/) → crea
   un proyecto (o usa uno existente).
2. Ve a **APIs y servicios → Pantalla de consentimiento OAuth**: tipo
   "Externo" (o "Interno" si tienen Google Workspace administrado),
   completa los datos mínimos.
3. Ve a **Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo de aplicación: **Aplicación web**.
   - Orígenes autorizados de JavaScript: `http://localhost:5173`
   - (No necesitas URI de redirección: el frontend usa el flujo de Google
     Identity Services, que devuelve el token directamente al navegador.)
4. Copia el **Client ID** generado (termina en `.apps.googleusercontent.com`).
   Lo necesitas en el backend y en el frontend (mismo valor en los dos).

Mientras Carlos no tenga el dominio institucional real habilitado para
pruebas, pueden usar sus propias cuentas de Gmail para probar el flujo,
cambiando temporalmente `ALLOWED_GOOGLE_DOMAIN` en `backend/.env` a
`gmail.com` (ver F-02, sección 2.5: la habilitación real depende del
administrador de TI, es un supuesto ya registrado en la documentación).

## 3. Base de datos

Con Docker instalado:

```bash
docker compose up -d
```

Esto levanta PostgreSQL 16 en `localhost:5432` con usuario `postgres`,
contraseña `postgres` y base de datos `conecta_bu`. Si prefieres Supabase,
crea un proyecto gratuito allí y usa su cadena de conexión en `DATABASE_URL`.

## 4. Backend

```bash
cd backend
cp .env.example .env
# Edita .env: DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID, ALLOWED_GOOGLE_DOMAIN

npm install
npm run prisma:generate
npm run prisma:migrate      # crea las tablas (todo el modelo de F-03, aunque hoy solo se usan Usuario y Rol)
npm run prisma:seed         # crea los roles Estudiante y Administrador

npm run dev                 # http://localhost:4000
```

Para probar sin configurar nada de lo anterior (sin Google real, sin
Postgres real), corre las pruebas automáticas:

```bash
npm test
```

Deben pasar 9 pruebas que cubren HU-01 a HU-05 (login válido, cuenta externa
rechazada, /me, logout, y /admin/ping con 401/403/200 según el rol).

Para convertir tu propio usuario en administrador una vez que ya iniciaste
sesión al menos una vez: define `ADMIN_EMAIL=tu-correo@uniautonoma.edu.co`
en `.env` y vuelve a correr `npm run prisma:seed`.

## 5. Frontend

```bash
cd frontend
cp .env.example .env
# Edita .env: VITE_GOOGLE_CLIENT_ID (el mismo Client ID del backend)

npm install
npm run dev                 # http://localhost:5173
```

Abre `http://localhost:5173`, inicia sesión con Google y deberías caer en
`/estudiante` (o en `/admin` si tu correo ya tiene ese rol en la base de
datos).

## 6. Cómo verificar manualmente cada historia (para la sustentación)

1. **HU-01**: inicia sesión con una cuenta permitida por `ALLOWED_GOOGLE_DOMAIN`
   → debes entrar y ver tu nombre en la barra superior.
2. **HU-02**: cierra sesión y vuelve a intentar con una cuenta de otro dominio
   → debe mostrarse el mensaje de que solo se permiten cuentas institucionales.
3. **HU-03**: con sesión iniciada, pulsa "Cerrar sesión" → vuelves a `/login`
   y ya no puedes entrar a `/estudiante` sin autenticarte de nuevo.
4. **HU-04**: entra con un usuario Estudiante y luego con uno Administrador
   (cambia el rol desde `npx prisma studio` si hace falta) → cada uno ve un
   menú y una ruta base distintas.
5. **HU-05**: como estudiante, abre las herramientas de desarrollador del
   navegador y llama `GET /api/v1/admin/ping` con tu token → responde 403.
   Como administrador, el panel administrativo ya lo llama automáticamente
   y muestra "Acceso administrativo confirmado".

## 7. Qué falta (para los siguientes sprints, no para este)

- Los endpoints y pantallas de servicios, horarios, citas, eventos,
  inscripciones, asistencia, usuarios, n8n, agente IA y dashboard
  (Sprints 2 a 5 del Product Backlog). El modelo de datos completo ya está
  en `backend/prisma/schema.prisma` para no tener que rediseñarlo.
- Desplegar en Vercel/Render/Supabase según la vista de despliegue de F-03.
- Publicar el contrato OpenAPI/Swagger (F-03, sección 3.4).
- Reemplazar el validador simple de `common/validators/validate.js` por
  Zod si quieren seguir el patrón DTO descrito en F-01.

## 8. Estructura de carpetas

Sigue exactamente la propuesta de F-03 (secciones 6.1 y 6.2), para que cada
historia futura tenga un lugar obvio donde ir:

```
backend/src/modules/   → un folder por dominio (auth, usuarios, citas, ...)
frontend/src/app/      → separado por rol (estudiante/, admin/) y luego por funcionalidad
```
