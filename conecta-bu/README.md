# Conecta BU

> **Avance por sprint** (rama `Luisa`)
>
> | Sprint | Qué incluye | Requisitos |
> |---|---|---|
> | 1 | Login institucional, roles y rutas protegidas | RF-001, RF-002 |
> | 2 | Servicios, agendamiento, mis citas y cancelación | RF-003 a RF-006 |
> | 3 | Gestión de horarios, agenda administrativa y asistencia a citas | RF-007, RF-008 |
> | 4 | Eventos: gestión, inscripción y asistencia | RF-009, RF-010, RF-011 |
> | 5 | Usuarios, automatización n8n, asistente IA y dashboard | RF-012 a RF-015 |
> | — | Portal de los 5 módulos y módulo **Salud integral** | ver sección al final |
>
> El detalle de los sprints 4 y 5 está al final de este archivo
> ([Sprint 4](#sprint-4--eventos-inscripciones-y-asistencia),
> [Sprint 5](#sprint-5--usuarios-n8n-asistente-ia-y-dashboard)).

## Sprint 1 (código base)

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

---

## Sprint 4 — Eventos, inscripciones y asistencia

Requisitos de F-02: **RF-009** (gestión de eventos), **RF-010** (consulta e
inscripción) y **RF-011** (control de asistencia), con las reglas **RN-006**
(sin inscripciones duplicadas), **RN-007** (no superar cupos), **RN-008**
(solo el administrador gestiona) y **RN-010** (asistencia solo sobre
inscritos). No requiere migración: las tablas `eventos`, `inscripciones`,
`asistencias_evento` e `historial_estados` ya estaban en el esquema.

| Método | Endpoint | Protección | RF / RN |
|---|---|---|---|
| GET | `/api/v1/eventos` | JWT | RF-010 (publicados y futuros, con cupos disponibles) |
| GET | `/api/v1/eventos/mis-inscripciones` | JWT | RF-010 |
| GET | `/api/v1/eventos/:id` | JWT | RF-010 |
| POST | `/api/v1/eventos/:id/inscripciones` | JWT | RF-010 / RN-006 / RN-007 |
| PATCH | `/api/v1/eventos/:id/inscripciones/cancelar` | JWT | RF-010 |
| GET / POST | `/api/v1/admin/eventos` | JWT + Administrador | RF-009 |
| GET / PATCH / DELETE | `/api/v1/admin/eventos/:id` | JWT + Administrador | RF-009 (DELETE pide `?confirmar=true` si hay inscritos) |
| PATCH | `/api/v1/admin/eventos/:id/estado` | JWT + Administrador | RF-009 (Borrador, Publicado, Cerrado, Cancelado) |
| GET | `/api/v1/admin/eventos/:id/inscripciones` | JWT + Administrador | RF-011 |
| PATCH | `/api/v1/admin/eventos/:id/inscripciones/:inscripcionId/asistencia` | JWT + Administrador | RF-011 / RN-010 |

Notas de diseño:

- Un evento nuevo queda en **Borrador** (o Publicado si se marca "Publicar de
  inmediato"). Los estudiantes solo ven eventos **Publicados** con fecha de
  hoy en adelante, y solo pueden inscribirse hasta la fecha límite.
- La inscripción corre en una transacción `Serializable`, así dos personas que
  toman el último cupo al mismo tiempo no superan el límite (RN-007).
- Si el estudiante cancela y luego se vuelve a inscribir, se reactiva su misma
  inscripción (hay un índice único `usuarioId + eventoId`).
- Cada cambio de estado del evento queda en `historial_estados`.
- `npm run prisma:seed` crea 3 eventos de ejemplo (2 publicados, 1 borrador).

Pruebas: `npm test` incluye `test/eventos.test.js`.

**Verificación manual:** como administrador, crea un evento en *Eventos*,
publícalo y ábrelo en *Inscritos y asistencia*; como estudiante, entra a
*Eventos*, inscríbete y comprueba que el cupo baja; vuelve como administrador
y marca la asistencia.

---

## Sprint 5 — Usuarios, n8n, asistente IA y dashboard

Requisitos de F-02: **RF-012** (administración de usuarios), **RF-013**
(automatización con n8n), **RF-014** (agente IA de orientación) y **RF-015**
(dashboard de estadísticas), con **RN-008** y **RN-011**. Tampoco requiere
migración.

| Método | Endpoint | Protección | RF / RN |
|---|---|---|---|
| GET | `/api/v1/admin/usuarios?busqueda=&rol=&habilitado=` | JWT + Administrador | RF-012 |
| PATCH | `/api/v1/admin/usuarios/:id/rol` | JWT + Administrador | RF-012 |
| PATCH | `/api/v1/admin/usuarios/:id/estado` | JWT + Administrador | RF-012 |
| GET | `/api/v1/admin/estadisticas?desde=&hasta=` | JWT + Administrador | RF-015 |
| GET | `/api/v1/admin/estadisticas/automatizaciones` | JWT + Administrador | RF-013 (últimos envíos a n8n) |
| POST | `/api/v1/asistente/consultas` | JWT | RF-014 / RN-011 |

### Usuarios (RF-012)

- El administrador busca usuarios, cambia su rol y los habilita/deshabilita.
- Un usuario deshabilitado pierde el acceso de inmediato (el middleware de
  autenticación revisa `habilitado` en cada petición).
- Nadie puede cambiarse su propio rol ni deshabilitarse, y siempre debe quedar
  al menos un administrador habilitado.

### Automatización con n8n (RF-013)

El backend envía un `POST` JSON a `N8N_WEBHOOK_URL` cuando ocurre:
`cita.agendada`, `cita.cancelada`, `evento.publicado`, `evento.inscripcion` y
`evento.inscripcion_cancelada`. Cuerpo:

```json
{ "tipo": "cita.agendada", "origen": "conecta-bu", "fecha": "2026-10-01T15:00:00.000Z",
  "datos": { "estudiante": { "id": "...", "nombre": "...", "email": "..." },
             "cita": { "citaId": "...", "servicio": "...", "fecha": "...", "horaInicio": "..." } } }
```

- Solo viaja la información necesaria para notificar (sin datos clínicos).
- El envío **no bloquea** la operación: si n8n no está configurado o falla, la
  cita/inscripción ya quedó guardada y el fallo se registra (flujo
  alternativo de RF-013). El administrador ve los últimos 50 envíos en
  *Estadísticas → Automatizaciones* (se reinicia con el servidor).
- Si defines `N8N_SECRET`, cada petición lleva la cabecera
  `X-Conecta-BU-Secret` para que el flujo de n8n verifique el origen.

Los flujos de n8n listos para importar (notificaciones por correo y agente con
Gemini) están en la carpeta [`n8n/`](n8n/README.md), con la guía paso a paso.
`docker compose up -d n8n` levanta n8n en http://localhost:5678.

### Asistente de orientación (RF-014)

1. **Filtros de seguridad (RN-011)** en el backend, antes de cualquier IA:
   preguntas sobre diagnósticos, medicamentos o tratamientos reciben una
   respuesta fija que orienta a agendar una cita; mensajes con señales de
   crisis reciben las líneas de ayuda (123, 192 opción 4) y la orientación a
   Bienestar. Estos mensajes nunca se envían al modelo.
2. Si `N8N_AGENTE_URL` está configurada, la pregunta va a ese webhook de n8n
   junto con contexto real (servicios activos, horarios disponibles, próximos
   eventos) y las reglas del agente. n8n debe responder `{ "respuesta": "..." }`.
   Ahí pueden conectar Gemini (nodo *Google Gemini Chat Model* o *AI Agent*) y
   terminar con *Respond to Webhook*.
3. Si n8n no está configurado o falla, el asistente responde con una base de
   conocimiento local construida con esos mismos datos, así la funcionalidad
   se puede demostrar sin n8n.

### Dashboard (RF-015)

Indicadores de estudiantes registrados, citas (atendidas, no asistieron,
canceladas, % de asistencia), asistencia por evento (asistieron / no
asistieron / sin registrar) y citas por servicio, con filtro por fechas. Si no
hay datos para el filtro, el panel lo indica.

### Variables nuevas en `backend/.env` (todas opcionales)

```
N8N_WEBHOOK_URL=   # webhook para automatizaciones (RF-013)
N8N_AGENTE_URL=    # webhook del agente IA (RF-014)
N8N_SECRET=        # se envía en la cabecera X-Conecta-BU-Secret
N8N_TIMEOUT_MS=8000
N8N_AGENTE_TIMEOUT_MS=20000
HORAS_MINIMAS_CANCELACION=24
```

Pruebas: `npm test` incluye `usuarios.test.js`, `estadisticas.test.js` y
`asistente.test.js` (este último simula n8n disponible y caído).

**Verificación manual:** como administrador, abre *Usuarios* y promueve o
deshabilita a un estudiante; abre *Estadísticas* y filtra por fechas. Como
estudiante, abre *Asistente* y pregunta "¿Cómo agendo una cita?" y "¿qué
medicamento tomo?" (debe negarse y orientarte a una cita).

## Módulo Salud integral

Reemplaza los Excel de la Unidad de Salud (registro general SPADIEZ,
formulario de atención de enfermería, reporte SNIES e informe de gestión
INFBI-002) y el formulario de Google de salidas institucionales
("0 SALUD INTEGRAL", ver *Salidas institucionales y reportes SST*).

**Acceso:** solo entra al panel `/salud` el personal cuyo correo fue asignado
al módulo Salud por el superadministrador (ver *Módulos independientes y
superadministrador*). El panel incluye:

- **Registrar**: con la cédula o el código estudiantil (también lector de
  código de barras) la persona queda registrada al instante. Si es la primera
  vez, se registra una sola vez con autorización de datos (Ley 1581). Modo
  *lista* para jornadas. En atención de enfermería se anotan signos vitales,
  insumos, descripción y remisión.
- **Actividades**: catálogo del periodo con código SNIES, meta, jornadas,
  asistentes y **evidencias** (fotos y PDF).
- **Personas** con su historial, **horarios y agenda de citas de salud**.
- **Reportes**: informe de gestión (matriz de atendidos, estadísticas y
  registro fotográfico), plantilla SNIES y registro de atenciones; e
  **importador** de los Excel existentes (vista previa, sin duplicados).

El estudiante tiene su propia área de Salud (`/mi-salud`): agenda citas de
salud, ve *sus* citas de salud y sus participaciones. Las citas se separan por módulo: se puede tener una cita de
orientación y una de salud a la vez.

**Después de actualizar el código:**

```
cd backend
npm install                 # librerías nuevas: multer (evidencias)
npx prisma migrate dev      # aplica la migración modulo_salud (tablas salud_*) y regenera el cliente
npm run prisma:seed         # rol Salud, servicios y catálogo de actividades
```

Variables opcionales en `backend/.env`:

```
SUPERADMIN_EMAIL=tu-correo@uniautonoma.edu.co  # superadministrador (al iniciar sesión y en el seed)
SALUD_EMAIL=enfermeria@uniautonoma.edu.co   # personal de Salud de prueba (seed)
SALUD_NOMBRE=Personal de Salud
SALUD_UPLOADS_DIR=                          # carpeta de evidencias (por defecto backend/uploads)
SALUD_MAX_EVIDENCIA_MB=10
```

Las evidencias se guardan en `backend/uploads/` (ignorada por git). En el
despliegue hay que apuntar `SALUD_UPLOADS_DIR` a un volumen persistente.

### Informe de gestión para el superadministrador (INFBI-002)

Reemplaza el Excel "INFORME DE GESTIÓN FINAL" con sus cinco hojas:

- **PROYECTO**: encabezado institucional (código INFBI-002, versión, fecha,
  página, logo), nombre del proyecto, fecha de presentación, tipo de acción,
  responsable, descripción, justificación, alineación estratégica y la tabla
  de objetivos, resultados y beneficios esperados.
- **INFORME - EVALUACIÓN**: logros significativos, dificultades presentadas y
  acciones de mejora, más los indicadores del periodo.
- **ATENDIDOS**: matriz por actividad y jornada (administrativos, docentes,
  egresados, externos, posgrados y cada programa de pregrado), total, meta,
  logro, cumplimiento con semáforo, avances, dificultades, aprendizajes,
  presupuesto ejecutado, **pendientes** y observaciones.
- **ESTADÍSTICAS**: impacto poblacional por año, población atendida del
  periodo, atención del servicio de enfermería, población general frente a
  años anteriores, asistencia de la población objeto y atenciones por línea
  de acción, con **gráficas nativas de Excel** (columnas, torta, líneas y
  barras) que apuntan a las celdas.
- **REGISTRO FOTOGRÁFICO**: las fotos subidas como evidencia.

En el panel de Salud, **Informe de gestión** (`/salud/informe`) guía en cinco
pasos: proyecto, evaluación (con un botón que inserta las cifras del periodo),
avances por actividad, cifras y años anteriores (tabla editable de 2014 a
2025, que viene precargada con las cifras del informe vigente) y revisar y
enviar (lista de lo que falta y avisos: actividades sin avances, sin meta, sin
fotos o con cumplimiento bajo). Se descarga en **PDF o Excel** en cualquier
momento. El primer informe trae los textos del formato vigente y los siguientes
copian los del informe anterior.

Al **enviarlo**, se guarda una copia de las cifras y queda bloqueado. El
superadministrador lo ve en **Informes de gestión** (`/super/informes`), lo
descarga en PDF o Excel (siempre con las cifras enviadas) y lo **aprueba** o lo
**devuelve** con observaciones; si lo devuelve, el módulo lo corrige y lo
reenvía (versión 2, 3…).

- Migración `20261007100000_informe_gestion` (tablas `informes_gestion` y
  `salud_historicos` con las cifras de 2014 a 2025, y la columna `pendientes`
  en las actividades). Librería nueva: `jszip` (ejecuta `npm install`).
- El logo de la Uniautónoma está en `backend/assets/logo-uniautonoma.png`
  (tomado del formato institucional).

### Salidas institucionales y reportes SST

Reemplaza el formulario de Google **"0 SALUD INTEGRAL"** con las mismas
secciones:

| Tipo | Anticipación | Documentos obligatorios |
|------|--------------|-------------------------|
| Salida con estudiantes · local / regional / nacional | — | Formato de la póliza estudiantil |
| Salida con estudiantes · internacional | 5 días (ASIST CARD) | Certificado de movilidad internacional |
| Representación institucional · local / regional / nacional | 3 días (ARL) | — |
| Representación institucional · internacional | 5 días (ASIST CARD) | Certificado de movilidad internacional |
| Traslado de docentes de posgrados | 3 días (ARL) | — |
| Condición insegura, acto inseguro o incidente | — | Evidencias fotográficas (opcionales) |

Además, según el transporte: **particular** → licencia, tarjeta de propiedad,
revisión técnico-mecánica y SOAT; **aéreo** → información del vuelo;
**público** → medio y empresa; **institucional** → conductor y placa. Los
demás participantes (colaboradores o docentes) se escriben en una lista con
su cédula o se adjunta el listado. Al escribir el nombre de quien viaja se
despliegan sugerencias (docentes y administrativos registrados en Salud y
personas de reportes anteriores, sin importar tildes) y al elegir una se
llena su cédula (`GET /reportes-sst/personas?q=`, solo nombre y documento).

- **Quién reporta:** cualquier persona de la Institución con su cuenta
  (`/reportes-sst`; también desde la tarjeta de Salud en el portal). Ve el
  estado de sus reportes y puede completar o reemplazar documentos mientras
  no estén verificados.
- **Quién revisa:** el personal de Salud en `/salud/salidas`: bandeja por
  estado (*Recibido → Verificado / Requiere ajustes → Cerrado*), detalle con
  los documentos, marca de "reportada a la ARL" o "ASIST CARD gestionada",
  observación para quien reporta y exportación a Excel (resumen, salidas y
  condiciones inseguras). No se puede verificar una salida con documentos
  faltantes; las reportadas con menos anticipación quedan marcadas *fuera de
  tiempo*.
- Migración `20261006090000_reportes_sst` (tablas `sst_reportes` y
  `sst_adjuntos`). Los documentos se guardan en `SALUD_UPLOADS_DIR/sst/`.

## Módulos independientes y superadministrador

Conecta BU agrupa varios módulos de Bienestar que **no se mezclan**:
Desarrollo humano y orientación (`/estudiante` para estudiantes, `/admin`
para su personal) y Salud integral (`/mi-salud` y `/salud`). Cada uno tiene
su menú, sus citas y sus reportes; el portal (`/`) permite cambiar de módulo.

**Roles**

| Rol | Qué puede hacer |
|---|---|
| Estudiante | Entra al área de estudiante de los módulos disponibles. |
| Administrador (personal) | Entra **solo** al panel de los módulos cuyo acceso le asignaron por correo. |
| SuperAdministrador | Entra a todos los módulos, asigna el personal de cada uno (`/super/accesos`) y administra usuarios y roles (`/super/usuarios`). |

El superadministrador asigna correos institucionales a cada módulo; se puede
asignar a alguien que todavía no ha entrado. Al quitarle todos los accesos,
la persona vuelve a ser estudiante. El backend lo valida en cada petición
(`403 SIN_ACCESO_MODULO`).

**Al actualizar:** `npx prisma migrate dev` aplica la migración
`accesos_modulo`, que crea el rol SuperAdministrador y conserva el acceso a
Desarrollo humano de los administradores que ya existían. Para crear el
primer superadministrador, define `SUPERADMIN_EMAIL` en `backend/.env`,
reinicia el backend y vuelve a iniciar sesión con ese correo: al entrar queda
como superadministrador (aunque antes fuera estudiante o personal). También
puedes ejecutar `npm run prisma:seed`, que ahora sí lee el `.env`.
