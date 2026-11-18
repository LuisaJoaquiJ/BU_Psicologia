# CORPORACIÓN UNIVERSITARIA AUTÓNOMA DEL CAUCA
## Facultad de Ingeniería — Programa de Ingeniería de Sistemas
### Sistemas de Información Empresarial (SIE) — Periodo 2026-2

---

# ANEXO E: PLAN DE PRUEBAS DE SOFTWARE Y EVIDENCIAS DE EJECUCIÓN
## Sistema de Información Conecta BU — Módulo de Desarrollo Humano y Orientación

---

### Control de Versiones del Documento

| Versión | Fecha | Autor(es) | Rol / Responsabilidad | Descripción del Cambio |
| :---: | :---: | :--- | :--- | :--- |
| **1.0.0** | 13/10/2026 | Luisa Jhulieth Joaqui<br>Carlos Santiago Torres Castrillón | Responsable de Calidad (F-00)<br>Líder Técnico (F-00) | Creación inicial del Plan de Pruebas. Consolidación de resultados de ejecución automática sobre el build `main` (commit `0b5930b`): 18 suites, 197 casos aprobados. Matriz de trazabilidad F-02. |
| **1.1.0** | 30/10/2026 | Luisa Jhulieth Joaqui<br>Carlos Santiago Torres Castrillón | Responsable de Calidad (F-00)<br>Líder Técnico (F-00) | Incorporación de evidencias de pruebas de carga concurrente (RNF-001: 50 usuarios), pruebas de agendamiento eficiente (RNF-003: 10 cuentas) y matriz de compatibilidad cross-browser y responsive (RNF-005: Chrome, Edge, Firefox 157). Documentación de casos complementarios (CP-014 a CP-022). |
| **1.2.0** | 15/11/2026 | Luisa Jhulieth Joaqui<br>Carlos Santiago Torres Castrillón | Responsable de Calidad (F-00)<br>Líder Técnico (F-00) | Consolidación académica para entrega formal de la asignatura SIE: estructuración detallada de casos de prueba con especificación Gherkin y tablas técnicas, análisis de no conformidades y manual de ejecución de pruebas. |

---

### Información General del Proyecto y Entidades Involucradas

- **Nombre del Sistema:** Conecta BU — Plataforma Integral de Bienestar Universitario
- **Módulo Central Evaluado:** Desarrollo Humano, Orientación Psicológica y Acompañamiento Estudiantil
- **Cliente Institucional:** Lic. Ancizar Paz — Coordinación del Área de Psicología, Unidad de Bienestar Universitario
- **Equipo de Desarrollo y Aseguramiento de Calidad:**
  - **Luisa Jhulieth Joaqui** — Responsable de Calidad y Pruebas
  - **Carlos Santiago Torres Castrillón** — Líder Técnico y Arquitectura de Software
- **Entorno Evaluado:** Entorno local controlado con banco de pruebas automatizado (Node.js v20+, Express 4, Jest 29.7, Supertest 7.0, mock in-memory de PostgreSQL/Prisma ORM y emulación de Google OAuth2).
- **Build y Commits Auditados:** 
  - Ejecución base: Rama `main`, Commit `0b5930b` (13 de octubre de 2026)
  - Pruebas de carga, compatibilidad y navegadores: Commit `53a9235` (30 de octubre de 2026)

---

## 1. Introducción y Objetivos del Plan de Pruebas

El presente documento constituye el **Anexo E: Plan de Pruebas y Evidencias** del sistema **Conecta BU**, enfocado primordialmente en el módulo de **Desarrollo Humano**. Este documento formaliza, cierra y da cumplimiento a la matriz de trazabilidad establecida en el numeral 8 del documento de especificación de requisitos **F-02**, el cual delegaba la especificación técnica y ejecución de los casos de prueba a la fase F-05.

### 1.1. Propósito
Verificar y validar de manera sistemática que el software desarrollado cumple a cabalidad con los Requisitos Funcionales (RF-001 al RF-010 del F-02, así como los RF-013 al RF-015 incorporados durante la evolución del sistema), las Reglas de Negocio institucionales (RN-001 a RN-011) y los Requisitos No Funcionales (RNF-001 al RNF-006).

### 1.2. Alcance
El alcance de este plan contempla:
1. **Módulo de Desarrollo Humano:** Servicios de orientación psicológica individual, gestión de agenda de profesionales, agendamiento de citas por estudiantes, cancelación anticipada, control de asistencia presencial y espontánea (sin cita), y programación y control de bloqueos de tiempo del personal.
2. **Gestión y Participación en Eventos y Talleres:** Publicación de talleres psicoeducativos, gestión de cupos, inscripciones en línea de estudiantes, cancelación de inscripciones y registro de asistencia.
3. **Mecanismos Transversales:** Autenticación federada mediante Google OAuth2 institucional (`@uniautonoma.edu.co`), autorización y control de acceso basado en roles (RBAC), tolerancia a fallos en integraciones externas (webhooks de n8n) y asistente conversacional de orientación con inteligencia artificial (Gemini) protegido mediante filtros de seguridad ética y clínica.
4. **Pruebas No Funcionales:** Evaluación de rendimiento bajo concurrencia (50 usuarios), tiempos de respuesta de agendamiento, compatibilidad en navegadores modernos de escritorio y diseño adaptable (*responsive*) en dispositivos móviles.

---

## 2. Estrategia de Pruebas

Para garantizar una evaluación rigurosa del software sin comprometer datos reales ni depender de infraestructura externa inestable durante la fase de integración continua, se diseñó una estrategia piramidal de pruebas basada en el aislamiento controlado.

```
            / \
           /   \         Pruebas E2E y Manuales de Usuario (Exploratorias)
          / Carga\       Pruebas de Carga y Rendimiento Concurrente (50 usuarios)
         /--------\      
        / Integrac.\     Pruebas de Integración de API (Supertest + Express App)
       /------------\    
      /  Unitarias   \   Pruebas Unitarias de Servicios y Lógica de Negocio
     / y Mocks Prisma \  (Jest Mocks in-memory de DB, Google OAuth y Gemini)
    --------------------
```

### 2.1. Tipos de Pruebas Implementados

#### A. Pruebas Unitarias y de Aislamiento
- **Objetivo:** Validar la lógica de negocio pura, cálculo de indicadores estadísticos, validación de formatos, reglas de anticipación temporal y filtros de seguridad sin interactuar con bases de datos ni servicios en red.
- **Técnica:** Mocks exhaustivos en Jest (`jest.mock("../src/config/prisma")`, mock de `google-auth-library`, simulación de `fetch` global para llamadas a n8n y Google Gemini). Se utiliza una base de datos reactiva simulada en memoria (`./test/mocks/prisma.mock.js`) que replica el comportamiento de las restricciones de clave única, conteos y relaciones de PostgreSQL.

#### B. Pruebas de Integración de API (Endpoints REST)
- **Objetivo:** Comprobar el correcto funcionamiento de la tubería HTTP completa de Express: enrutadores, middlewares de validación de esquemas (Joi / validadores propios), middlewares de autenticación (`requireAuth`), middlewares de autorización RBAC (`requireRole`), llamadas a la capa de servicios y formateo de respuestas JSON con los códigos de estado HTTP correctos (200, 201, 400, 401, 403, 404, 409).
- **Técnica:** Uso de **Supertest 7.0** inyectando peticiones virtuales directamente a la instancia exportada de `app` sin necesidad de levantar el servidor TCP en un puerto del sistema operativo.

#### C. Pruebas Funcionales (Caja Negra basada en Especificación F-02)
- **Objetivo:** Verificar cada flujo de usuario desde la perspectiva de las historias de usuario (HU-001 a HU-020), cubriendo caminos felices (*happy paths*), casos límite (*boundary values*) y flujos alternativos de error (intentos de doble reserva, solapamiento de horarios, cupos agotados, peticiones sin credenciales).

#### D. Pruebas de Carga y Concurrencia (RNF-001)
- **Objetivo:** Determinar el comportamiento y estabilidad de los endpoints de lectura crítica cuando 50 usuarios virtuales realizan solicitudes simultáneas contra el servidor API.
- **Técnica:** Generación de ráfagas concurrentes mediante promesas paralelas (`Promise.all`) contra el servidor Express local (`http://localhost:4000`), cronometrando el tiempo de respuesta individual, la mediana y el percentil máximo (*worst-case latency*).

#### E. Pruebas de Compatibilidad y Diseño Adaptable (RNF-005)
- **Objetivo:** Asegurar que la interfaz SPA desarrollada en React + Vite + TailwindCSS se renderice de forma consistente, legible e interactiva en los principales motores de renderizado web y en resoluciones estándar.
- **Técnica:** Verificación directa en navegadores Google Chrome y Microsoft Edge instalados en el entorno de desarrollo, y validación automatizada sobre el motor Gecko de **Mozilla Firefox 157** utilizando los binarios de Playwright. Verificación en viewport de escritorio (1366×768) y emulación de dispositivo móvil inteligente (viewport estándar 390×844 correspondiente a pantallas de smartphones modernos).

---

## 3. Configuración del Entorno de Pruebas

Para asegurar la reproducibilidad de las pruebas en cualquier estación de trabajo o servidor de integración continua (CI), se aisló por completo la infraestructura de pruebas.

### 3.1. Ficha Técnica de Hardware y Software de Pruebas

| Parámetro | Especificación del Entorno |
| :--- | :--- |
| **Sistema Operativo** | Microsoft Windows 11 Education / Pro (x64) |
| **Plataforma de Ejecución** | Node.js v20.x LTS / npm 10.x |
| **Framework de Pruebas Unitarias** | Jest 29.7.0 |
| **Librería de Pruebas de Integración HTTP** | Supertest 7.0.0 |
| **Motor de Base de Datos en Producción** | PostgreSQL 16 (gestionado vía Prisma ORM 5.x) |
| **Mecanismo de Base de Datos en Pruebas** | Simulación reactiva in-memory (`prisma.mock.js`) |
| **Emulación de Motores Cross-Browser** | Playwright v1.48 (Headless Gecko / Firefox 157 engine) |
| **Navegadores Locales Verificados** | Google Chrome v129+, Microsoft Edge v129+ |
| **Servidor de Aplicación en Prueba de Carga**| Express 4 escuchando en `http://localhost:4000` |
| **Cliente Web en Prueba de Carga** | Vite Dev Server en `http://localhost:5173` |

### 3.2. Variables de Entorno para el Entorno de Pruebas (`.env.test`)

Durante la ejecución de las suites con Jest, el entorno configura automáticamente las siguientes variables en memoria:

```ini
PORT=4000
DATABASE_URL="postgresql://user:pass@localhost:5432/test"
JWT_SECRET="secreto-de-pruebas-automatizadas-conecta-bu-2026"
GOOGLE_CLIENT_ID="google-client-id-pruebas.apps.googleusercontent.com"
ALLOWED_GOOGLE_DOMAIN="uniautonoma.edu.co"
FRONTEND_URL="http://localhost:5173"
N8N_WEBHOOK_URL="http://n8n.test/webhook/conecta-bu"
N8N_AGENTE_URL="http://n8n.test/webhook/asistente"
N8N_SECRET="token-secreto-n8n-test"
```

> [!NOTE]
> Gracias al archivo de inicialización y a la estructura de mocks en `backend/test/mocks/prisma.mock.js`, las suites de pruebas se ejecutan de forma totalmente autónoma: no requieren que PostgreSQL esté encendido, no realizan peticiones reales a Google OAuth ni a la API de Google Gemini, y no envían tráfico real a internet, garantizando pruebas reproducibles en menos de 35 segundos.

---

## 4. Matriz de Trazabilidad de Requisitos

La siguiente matriz establece la correspondencia biunívoca entre los Requisitos del documento F-02, las Historias de Usuario desarrolladas, el componente arquitectónico de software, el caso de prueba asignado y el estado final de verificación.

| Requisito F-02 / Ext. | Historia de Usuario | Módulo / Componente Técnico | Identificador de Caso | Estado de Ejecución |
| :--- | :--- | :--- | :---: | :---: |
| **RF-001:** Registro institucional | **HU-001:** Entrar con cuenta institucional | `auth.service.js` + `POST /auth/google` | **CP-001** | **Aprobado** |
| **RF-002:** Inicio de sesión y roles | **HU-002:** Mantener sesión y menú RBAC | `auth.controller.js` + `GET /auth/me` | **CP-002** | **Aprobado** |
| **RF-002 / RN-001:** Dominio institucional | **HU-001:** Rechazo de cuentas no institucionales | Middleware `validarDominioGoogle` | **CP-003** | **Aprobado** |
| **RF-003:** Consulta de horarios | **HU-003:** Ver horarios libres disponibles | `citas.service.js` + `GET /citas/horarios` | **CP-004** | **Aprobado** |
| **RF-004 / RN-003:** Agendamiento único | **HU-004:** Confirmar cita sin duplicados | `citas.service.js` + `POST /citas` | **CP-005** | **Aprobado** |
| **RF-005:** Mis citas y cancelación | **HU-005:** Ver y cancelar cita propia (24h) | `citas.service.js` + `PATCH /citas/:id/cancelar` | **CP-006** | **Aprobado** |
| **RF-006:** Registro de asistencia a cita | **HU-009:** Personal marca asistencia a cita | `horarios.service.js` + `PATCH /admin/citas` | **CP-007** | **Aprobado** |
| **RF-007:** Gestión de eventos y talleres | **HU-006:** Personal crea, edita y publica eventos | `eventos.service.js` + `POST/PATCH/DELETE` | **CP-008** | **Aprobado** |
| **RF-008 / RN-002 / RN-003:** Inscripción | **HU-007:** Inscribirse a taller sin superar cupo | `eventos.service.js` + `POST /eventos/:id/ins` | **CP-009** | **Aprobado** |
| **RF-009 / RN-010:** Asistencia a eventos | **HU-010:** Control de asistencia a inscritos | `eventos.service.js` + `PATCH /asistencia` | **CP-010** | **Aprobado** |
| **RF-010 (A):** Configuración de horarios | **HU-008:** Crear y deshabilitar horarios admin | `horarios.service.js` + `/admin/horarios` | **CP-011** | **Aprobado** |
| **RF-010 (B):** Administración de usuarios | **HU-008:** Superadmin asigna roles y estado | `UsuarioService.js` + `/admin/usuarios` | **CP-012** | **Aprobado** |
| **RF-002 / RN-008:** Protección de rutas | **HU-002:** RBAC en endpoints administrativos | Middlewares `requireAuth`, `requireRole` | **CP-013** | **Aprobado** |
| **RF-014 / RN-011:** Asistente IA Seguro | **HU-012:** Orientación virtual ética sin clínica | `asistente.service.js` + `/asistente/consultas` | **CP-014** | **Aprobado** |
| **RF-013 / HU-011:** Resiliencia en webhooks| **HU-011:** Guardar citas si n8n no responde | `n8n.client.js` + cola de reintentos | **CP-015** | **Aprobado** |
| **RF-015 / HU-013:** Dashboard y Reportes | **HU-013:** Tablero estadístico y reportes | `estadisticas.service.js` + `/estadisticas` | **CP-016** | **Aprobado** |
| **RF-Ext / HU-020:** Atención sin cita previa | **HU-020:** Atención directa y bloqueos agenda | `sincita.test.js`, `bloqueos.test.js` | **CP-022** | **Aprobado** |

---

## 5. Casos de Prueba Detallados

A continuación se presentan las fichas técnicas detalladas de cada caso de prueba documentado en la bitácora y suites de pruebas de Conecta BU.

### 5.1. Casos del Alcance Contractual (F-02)

#### CP-001: Creación automática de cuenta al ingresar con correo institucional
- **Requisito Asociado:** RF-001 (Registro de Usuarios) | Historia: HU-001
- **Componente:** `modules/auth/services/auth.service.js` — Endpoint: `POST /api/v1/auth/google`
- **Precondición:** El usuario posee una cuenta válida en Google Workspace bajo el dominio institucional (`estudiante.prueba@uniautonoma.edu.co`) que no ha sido registrada previamente en la base de datos de Conecta BU.
- **Pasos de Ejecución:**
  1. Enviar una petición HTTP `POST` a `/api/v1/auth/google`.
  2. Enviar en el cuerpo de la petición un objeto JSON con un token de identidad válido: `{"idToken": "token-valido-estudiante"}`.
  3. El backend verifica la autenticidad del token mediante `google-auth-library`.
  4. El backend extrae el correo, nombre y valida el dominio permitido.
- **Resultado Esperado:** 
  - Código HTTP **200 OK**.
  - Objeto JSON en respuesta con propiedad `token` (JWT válido firmado con `JWT_SECRET`).
  - Objeto `usuario` creado con `email: "estudiante.prueba@uniautonoma.edu.co"`, `rol: "Estudiante"` y `habilitado: true`.
- **Resultado Obtenido:** Código HTTP 200 recibido. Usuario persistido en BD con rol Estudiante y token JWT emitido correctamente.
- **Evidencia Técnica:** Archivo de prueba `test/auth.test.js` (Línea 53). Suite: `RF-001 / HU-01: inicio de sesion institucional`.
- **Estado:** **Aprobado**.

---

#### CP-002: Verificación de sesión activa (`/me`) y cierre de sesión seguro (`/logout`)
- **Requisito Asociado:** RF-002 (Inicio y Cierre de Sesión) | Historia: HU-002
- **Componente:** `modules/auth/controllers/auth.controller.js` — Endpoints: `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`
- **Precondición:** Usuario existente y autenticado previamente con un token JWT válido.
- **Pasos de Ejecución:**
  1. Enviar petición `GET` a `/api/v1/auth/me` con la cabecera `Authorization: Bearer <token_valido>`.
  2. Verificar que el servidor responde con el perfil y rol del usuario.
  3. Enviar petición `POST` a `/api/v1/auth/logout` con la misma cabecera.
  4. Enviar petición `GET` a `/api/v1/auth/me` sin cabecera de autorización.
- **Resultado Esperado:**
  - `GET /me` con token: Código HTTP **200 OK**, payload con datos del usuario autenticado.
  - `POST /logout`: Código HTTP **200 OK**.
  - `GET /me` sin token: Código HTTP **401 Unauthorized** con mensaje de error de autenticación.
- **Resultado Obtenido:** Respuestas 200 y 401 obtenidas exactamente según lo previsto. Verificación manual adicional realizada en navegador el 13 de octubre de 2026 con la cuenta `carlos.torres.c@uniautonoma.edu.co`.
- **Evidencia Técnica:** Archivo `test/auth.test.js` (Líneas 91-119). Suite: `RF-002 / HU-03 y HU-04: sesion, roles y /me`.
- **Estado:** **Aprobado**.

---

#### CP-003: Rechazo de cuentas externas ajenas al dominio institucional
- **Requisito Asociado:** RF-002 / Regla de Negocio: RN-001 (Restricción de Dominio) | Historia: HU-001
- **Componente:** `common/middlewares/auth.middleware.js` — Endpoint: `POST /api/v1/auth/google`
- **Precondición:** Usuario intenta acceder con un token de Google cuyo correo electrónico pertenece a un dominio comercial o externo (ej. `@gmail.com`).
- **Pasos de Ejecución:**
  1. Enviar una petición `POST` a `/api/v1/auth/google`.
  2. Enviar en el cuerpo un token de Google simulado con cuenta externa: `{"idToken": "token-cuenta-externa"}` (correo: `persona@gmail.com`).
  3. El backend procesa el token y compara el dominio del correo con la variable `ALLOWED_GOOGLE_DOMAIN`.
- **Resultado Esperado:**
  - Código HTTP **403 Forbidden**.
  - Cuerpo de respuesta con mensaje descriptivo indicando que el dominio no está autorizado para acceder al sistema.
  - Ningún registro de usuario nuevo creado en la base de datos.
  - *Excepción contemplada:* Si el correo externo fue registrado previamente por el SuperAdmin como personal autorizado en `accesos_modulo`, se le concede acceso como Administrador.
- **Resultado Obtenido:** Código HTTP 403 obtenido para cuenta externa no autorizada; código 200 concedido únicamente cuando existía autorización expresa en `accesos_modulo`.
- **Evidencia Técnica:** Archivo `test/auth.test.js` (Líneas 72-88). Suite: `RN-001 / HU-02: rechazo de cuentas no institucionales`.
- **Estado:** **Aprobado**.

---

#### CP-004: Consulta de horarios disponibles de orientación psicológica
- **Requisito Asociado:** RF-003 (Consulta de Horarios Libres) | Historia: HU-003
- **Componente:** `modules/desarrollo-humano/services/citas.service.js` — Endpoint: `GET /api/v1/citas/horarios-disponibles`
- **Precondición:** Existen en base de datos horarios configurados en el futuro: unos libres (`ocupado: false`) y otros reservados (`ocupado: true`), así como horarios pasados de fechas anteriores.
- **Pasos de Ejecución:**
  1. Autenticarse como estudiante y obtener token JWT.
  2. Enviar petición `GET` a `/api/v1/citas/horarios-disponibles` con la cabecera `Authorization`.
  3. Evaluar el arreglo de horarios devuelto.
- **Resultado Esperado:**
  - Código HTTP **200 OK**.
  - El listado contiene única y exclusivamente los horarios habilitados, cuya fecha y hora sean futuras respecto a la hora actual de Colombia (UTC-5), y cuya propiedad `ocupado` sea `false`.
  - Si no existen horarios libres, retorna un arreglo vacío `[]` con código 200.
  - Peticiones sin token devuelven **401 Unauthorized**.
- **Resultado Obtenido:** Código 200. Se filtraron automáticamente los horarios pasados y los ocupados. Comprobado retorno de arreglo vacío sin fallos.
- **Evidencia Técnica:** Archivo `test/citas.test.js` (Líneas 62-98). Suite: `RF-004 / HU-07: consulta de horarios disponibles`.
- **Estado:** **Aprobado**.

---

#### CP-005: Agendamiento de cita y ocupación inmediata del cupo
- **Requisito Asociado:** RF-004 / Regla de Negocio: RN-003 (Exclusividad de Cupo) | Historia: HU-004
- **Componente:** `modules/desarrollo-humano/services/citas.service.js` — Endpoint: `POST /api/v1/citas`
- **Precondición:** Existe un horario libre publicado para una fecha futura. El estudiante autenticado no tiene citas activas en el módulo.
- **Pasos de Ejecución:**
  1. Estudiante envía petición `POST` a `/api/v1/citas` con payload `{"horarioId": "<id_horario>"}`.
  2. Verificar respuesta y cambio de estado del horario.
  3. Intentar realizar un segundo agendamiento sobre el mismo horario inmediatamente con otro estudiante.
  4. Intentar que el mismo estudiante agende una segunda cita en otro horario libre.
- **Resultado Esperado:**
  - Primera reserva: Código HTTP **201 Created**, cita creada con estado `Agendada`, horario marcado como `ocupado: true`.
  - Intento de colisión (mismo horario ocupado): Código HTTP **409 Conflict**.
  - Estudiante con cita activa previa: Código HTTP **409 Conflict** (regla de máximo 1 cita activa por estudiante en orientación).
- **Resultado Obtenido:** Código 201 en la primera llamada; los horarios ocupados dejaron de ofrecerse en la consulta y los intentos concurrentes o duplicados respondieron 409 Conflict.
- **Evidencia Técnica:** Archivo `test/citas.test.js` (Líneas 100-167). Suite: `RF-005 / HU-08, HU-09, HU-10: agendamiento de citas`.
- **Estado:** **Aprobado**.

---

#### CP-006: Visualización de citas propias y cancelación con anticipación mínima (24h)
- **Requisito Asociado:** RF-005 (Cancelación Oportuna) | Historia: HU-005
- **Componente:** `modules/desarrollo-humano/services/citas.service.js` — Endpoints: `GET /api/v1/citas/mias`, `PATCH /api/v1/citas/:id/cancelar`
- **Precondición:** El estudiante posee una cita agendada para dentro de 3 días (más de 24 horas en el futuro).
- **Pasos de Ejecución:**
  1. Enviar petición `GET` a `/api/v1/citas/mias`.
  2. Verificar que solo se listen las citas asociadas al `usuarioId` del token.
  3. Enviar petición `PATCH` a `/api/v1/citas/<id_cita>/cancelar` con más de 24 horas de anticipación.
  4. Repetir la cancelación sobre una cita que inicia en 2 horas (menos de 24 horas de anticipación).
  5. Intentar cancelar una cita perteneciente a otro estudiante.
- **Resultado Esperado:**
  - Cancelación válida (+24h): Código HTTP **200 OK**, estado de la cita cambia a `Cancelada`, horario asociado vuelve a quedar libre (`ocupado: false`).
  - Cancelación tardía (-24h): Código HTTP **409 Conflict** con mensaje de restricción por plazo de 24 horas.
  - Cita ajena: Código HTTP **404 Not Found** (aislamiento de datos de usuario).
- **Resultado Obtenido:** Cancelación exitosa con liberación de horario demostrada; rechazo 409 verificado ante plazos menores a 24 horas; rechazo 404 ante citas ajenas.
- **Evidencia Técnica:** Archivo `test/citas.test.js` (Líneas 169-271). Suite: `RF-006 / HU-11 y HU-12: mis citas y cancelacion`.
- **Estado:** **Aprobado**.

---

#### CP-007: Registro de asistencia a cita por parte del personal administrativo
- **Requisito Asociado:** RF-006 (Control de Asistencia) | Historia: HU-009
- **Componente:** `modules/desarrollo-humano/services/horarios.service.js` — Endpoint: `PATCH /api/v1/admin/citas/:id/asistencia`
- **Precondición:** Existe una cita agendada en el sistema. El usuario actuante posee rol de Administrador de Desarrollo Humano.
- **Pasos de Ejecución:**
  1. Administrador envía petición `PATCH` con payload `{"asistio": true}`.
  2. Verificar actualización del estado de la cita.
  3. Intentar registrar asistencia sobre una cita cancelada.
  4. Intentar enviar la petición con credenciales de estudiante.
- **Resultado Esperado:**
  - Asistencia positiva: Código HTTP **200 OK**, cita cambia a estado `Atendida`.
  - Asistencia negativa: Código HTTP **200 OK**, cita cambia a estado `NoAsistio`.
  - Registro duplicado o sobre cita cancelada: Código HTTP **409 Conflict**.
  - Intento de ejecución por estudiante: Código HTTP **403 Forbidden**.
- **Resultado Obtenido:** Estados actualizados con éxito; restricciones de doble registro (409) y RBAC (403 para estudiantes) validadas.
- **Evidencia Técnica:** Archivo `test/horarios.test.js` (Líneas 260-345). Suite: `RF-008 / HU-16: registro de asistencia`.
- **Estado:** **Aprobado**.

---

#### CP-008: Ciclo de vida completo en la gestión de eventos por el personal
- **Requisito Asociado:** RF-007 (Gestión de Eventos y Talleres) | Historia: HU-006
- **Componente:** `modules/desarrollo-humano/services/eventos.service.js` — Endpoints: `POST /api/v1/admin/eventos`, `PATCH .../estado`, `DELETE .../:id`
- **Precondición:** Personal administrativo autenticado con permisos en el módulo.
- **Pasos de Ejecución:**
  1. Crear un evento con datos válidos (nombre, cupos, fecha, fecha límite de inscripción).
  2. Modificar el estado del evento de `Borrador` a `Publicado`.
  3. Intentar eliminar el evento cuando ya cuenta con estudiantes inscritos (sin confirmación).
  4. Repetir la eliminación agregando el parámetro de consulta `?confirmar=true`.
- **Resultado Esperado:**
  - Creación: Código HTTP **201 Created**, evento guardado inicialmente en estado `Borrador`.
  - Publicación: Código HTTP **200 OK**, cambio de estado registrado en tabla `HistorialEstado` para trazabilidad de auditoría.
  - Eliminación con inscritos sin confirmación: Código HTTP **409 Conflict**.
  - Eliminación confirmada: Código HTTP **200 OK**, evento marcado como cancelado/retirado.
- **Resultado Obtenido:** Evento creado en Borrador, publicado con auditoría en historial y borrado condicionado a confirmación cuando tiene inscritos activos.
- **Evidencia Técnica:** Archivo `test/eventos.test.js` (Líneas 66-186). Suite: `RF-009 / RN-008: gestion de eventos (administrador)`.
- **Estado:** **Aprobado**.

---

#### CP-009: Inscripción a talleres sin duplicación ni sobrecupo
- **Requisito Asociado:** RF-008 / Reglas: RN-002, RN-003 | Historia: HU-007
- **Componente:** `modules/desarrollo-humano/services/eventos.service.js` — Endpoint: `POST /api/v1/eventos/:id/inscripciones`
- **Precondición:** Evento en estado `Publicado` con cupos disponibles (`cupos: 1`) y fecha límite de inscripción futura.
- **Pasos de Ejecución:**
  1. Estudiante A se inscribe al evento.
  2. Estudiante A intenta inscribirse nuevamente al mismo evento.
  3. Estudiante B intenta inscribirse cuando el cupo ya está en 0.
  4. Estudiante A cancela su inscripción y Estudiante B reintenta.
- **Resultado Esperado:**
  - Primera inscripción (Estudiante A): Código HTTP **201 Created**, estado `Confirmada`, cupos disponibles disminuyen en 1.
  - Reintento del mismo estudiante: Código HTTP **409 Conflict** (no se duplica).
  - Sobrecupo (Estudiante B): Código HTTP **409 Conflict** (mensaje indicando cupos agotados).
  - Cancelación y reintento: Cancelación responde 200, libera el cupo y Estudiante B logra inscribirse exitosamente (201).
- **Resultado Obtenido:** Control riguroso de concurrencia y cupos; imposibilidad de duplicar inscripción demostrada en suite automatizada.
- **Evidencia Técnica:** Archivo `test/eventos.test.js` (Líneas 188-273). Suite: `RF-010: consulta e inscripcion a eventos (estudiante)`.
- **Estado:** **Aprobado**.

---

#### CP-010: Control de asistencia a eventos exclusivo para estudiantes inscritos
- **Requisito Asociado:** RF-009 / Regla de Negocio: RN-010 | Historia: HU-010
- **Componente:** `modules/desarrollo-humano/services/eventos.service.js` — Endpoint: `PATCH /api/v1/admin/eventos/:id/inscripciones/:insId/asistencia`
- **Precondición:** Existe un evento con inscripciones confirmadas y una inscripción cancelada.
- **Pasos de Ejecución:**
  1. Administrador marca asistencia positiva (`{"asistio": true}`) sobre la inscripción válida.
  2. Administrador intenta marcar asistencia utilizando el ID de una inscripción perteneciente a otro evento.
  3. Administrador intenta registrar asistencia sobre una inscripción que fue previamente cancelada.
- **Resultado Esperado:**
  - Inscripción válida: Código HTTP **200 OK**, registro de asistencia asociado al ID del administrador que auditó.
  - Inscripción de otro evento: Código HTTP **404 Not Found**.
  - Inscripción cancelada: Código HTTP **409 Conflict**.
- **Resultado Obtenido:** Asistencia guardada y corregible; rechazos 404 y 409 emitidos ante registros no válidos o inscripciones canceladas.
- **Evidencia Técnica:** Archivo `test/eventos.test.js` (Líneas 275-339). Suite: `RF-011 / RN-010: control de asistencia a eventos`.
- **Estado:** **Aprobado**.

---

#### CP-011: Creación, solapamiento y deshabilitación de horarios de atención
- **Requisito Asociado:** RF-010 (Gestión de Horarios) | Historia: HU-008
- **Componente:** `modules/desarrollo-humano/services/horarios.service.js` — Endpoints: `POST /api/v1/admin/horarios`, `PATCH .../deshabilitar`
- **Precondición:** Administrador autenticado. No existen solapamientos previos de horas para el mismo profesional/servicio.
- **Pasos de Ejecución:**
  1. Crear horario de 09:00 a 10:00 para mañana.
  2. Intentar crear un horario de 09:30 a 10:30 para el mismo servicio (solapamiento).
  3. Deshabilitar un horario libre directamente.
  4. Deshabilitar un horario que tiene una cita activa agendada (probar sin confirmación y con `{"confirmar": true}`).
- **Resultado Esperado:**
  - Creación válida: Código HTTP **201 Created**.
  - Solapamiento: Código HTTP **409 Conflict**.
  - Deshabilitación de horario libre: Código HTTP **200 OK**, `ocupado: true` (estudiantes ya no lo ven).
  - Deshabilitación con cita activa: Código HTTP **409 Conflict** sin confirmación; código **200 OK** con confirmación, cancelando automáticamente la cita del estudiante.
- **Resultado Obtenido:** Validación de intervalos de tiempo correcta; conflicto ante solapamientos; cancelación en cascada con confirmación funcional.
- **Evidencia Técnica:** Archivo `test/horarios.test.js` (Líneas 54-218). Suites: `RF-007 / HU-13` y `RF-007 / HU-14`.
- **Estado:** **Aprobado**.

---

#### CP-012: Administración de usuarios: roles, permisos y deshabilitación de cuentas
- **Requisito Asociado:** RF-010 (Administración de Usuarios y Roles) / RN-008 | Historia: HU-008
- **Componente:** `modules/super/services/UsuarioService.js` — Endpoints: `GET /api/v1/admin/usuarios`, `PATCH .../rol`, `PATCH .../estado`
- **Precondición:** SuperAdministrador autenticado en la plataforma.
- **Pasos de Ejecución:**
  1. Listar usuarios con filtros por nombre y rol.
  2. Cambiar el rol de un estudiante a Administrador.
  3. Deshabilitar la cuenta de un estudiante (`{"habilitado": false}`).
  4. Estudiante deshabilitado intenta realizar una consulta a `/api/v1/auth/me`.
  5. SuperAdministrador intenta deshabilitarse a sí mismo o dejar el sistema sin administradores habilitados.
- **Resultado Esperado:**
  - Listado y cambio de rol: Código HTTP **200 OK**.
  - Deshabilitación: Código HTTP **200 OK**. La cuenta deshabilitada recibe inmediatamente **401 Unauthorized** en su siguiente petición.
  - Auto-deshabilitación: Código HTTP **403 Forbidden**.
  - Eliminar el último administrador activo: Código HTTP **409 Conflict**.
- **Resultado Obtenido:** Control de acceso y reglas de salvaguarda del sistema cumplidas estrictamente; el middleware intercepta al usuario deshabilitado en su siguiente llamado.
- **Evidencia Técnica:** Archivo `test/usuarios.test.js` (Líneas 16-135). Suites: `RF-012: consulta de usuarios` y `RF-012: cambio de rol y estado`.
- **Estado:** **Aprobado**.

---

#### CP-013: Control de acceso basado en roles (RBAC) y protección de endpoints
- **Requisito Asociado:** RF-002 / Seguridad Institucional | Historia: HU-002
- **Componente:** `common/middlewares/auth.middleware.js` — Endpoint: `GET /api/v1/admin/ping`
- **Precondición:** Servidor Express inicializado con rutas administrativas protegidas.
- **Pasos de Ejecución:**
  1. Invocar `GET /api/v1/admin/ping` sin cabecera `Authorization`.
  2. Invocar el mismo endpoint con token de usuario con rol `Estudiante`.
  3. Invocar el mismo endpoint con token de usuario con rol `Administrador`.
- **Resultado Esperado:**
  - Petición anónima: Código HTTP **401 Unauthorized**.
  - Petición como Estudiante: Código HTTP **403 Forbidden**.
  - Petición como Administrador: Código HTTP **200 OK** con cuerpo `{"message": "confirmado"}`.
- **Resultado Obtenido:** Cumplimiento total de la matriz de autorización RBAC en todas las combinaciones probadas.
- **Evidencia Técnica:** Archivo `test/auth.test.js` (Líneas 121-152). Suite: `HU-05 / RN-008: proteccion de rutas administrativas`.
- **Estado:** **Aprobado**.

---

### 5.2. Casos Complementarios de Arquitectura y Valor Agregado

#### CP-014: Asistente IA de orientación: respuestas institucionales, bloqueo clínico y líneas de emergencia
- **Requisito Asociado:** RF-014 / Regla de Negocio: RN-011 (Límites Éticos de la IA) | Historia: HU-012
- **Componente:** `modules/desarrollo-humano/services/asistente.service.js` — Endpoint: `POST /api/v1/asistente/consultas`
- **Precondición:** Estudiante autenticado interactúa con el chat de orientación.
- **Pasos de Ejecución:**
  1. Enviar consulta institucional general: *«¿Cómo agendo una cita de orientación?»*.
  2. Enviar consulta clínica médica: *«¿Qué medicamento debo tomar para calmar la ansiedad?»*.
  3. Enviar consulta de crisis / ideación de autolesión: *«A veces pienso en hacerme daño / quitarme la vida»*.
- **Resultado Esperado:**
  - Consulta general: Código HTTP **200 OK**, respuesta proveniente de Gemini API / n8n / base local explicando el procedimiento de agendamiento.
  - Consulta médica: Código HTTP **200 OK**, interceptada por filtros locales de seguridad (`origen: "seguridad"`). Se bloquea la petición hacia la IA externa, responde que no emite diagnósticos ni formula medicamentos e invita a agendar cita con un profesional.
  - Consulta de crisis: Código HTTP **200 OK**, interceptada por filtro ético (`origen: "seguridad"`). Responde de inmediato con líneas oficiales de atención de emergencia (Línea 123 y 192 opción 4) e insta a acudir presencialmente a Bienestar.
- **Resultado Obtenido:** Filtros de seguridad ejecutados en memoria local sin enviar datos sensibles a modelos de lenguaje externos. Privacidad garantizada (el correo institucional es omitido del prompt).
- **Evidencia Técnica:** Archivo `test/asistente.test.js` (Líneas 39-145). Suite: `RF-014: asistente de orientacion`.
- **Estado:** **Aprobado**.

---

#### CP-015: Tolerancia a fallos en el sistema de notificaciones automáticas (n8n)
- **Requisito Asociado:** RF-013 (Automatización de Notificaciones) | Historia: HU-011
- **Componente:** `integrations/n8n.client.js` — Disparador de eventos en `citas.service.js`
- **Precondición:** El servicio orquestador de flujos n8n no se encuentra en ejecución o presenta fallo de conexión (`ECONNREFUSED`).
- **Pasos de Ejecución:**
  1. Estudiante agenda una cita de orientación psicológica.
  2. El backend intenta emitir el webhook hacia `N8N_WEBHOOK_URL`.
  3. La conexión falla a nivel de red.
- **Resultado Esperado:**
  - La cita del estudiante se guarda y confirma en la base de datos de manera atómica (Código HTTP **201 Created**).
  - El fallo de notificación se captura y se registra en la tabla de auditoría de automatizaciones (`estado: "fallida"`).
  - El estudiante nunca experimenta un error 500 ni pierde su cupo reservado.
- **Resultado Obtenido:** Resiliencia demostrada. La indisponibilidad del servicio de correos/webhooks no interrumpe la operación transaccional del sistema.
- **Evidencia Técnica:** Archivo `test/asistente.test.js` (Líneas 205-272). Suite: `RF-013: automatizacion con n8n`.
- **Estado:** **Aprobado**.

---

#### CP-016: Tablero de analítica, indicadores de gestión y exportación de reportes
- **Requisito Asociado:** RF-015 (Panel de Estadísticas) | Historia: HU-013
- **Componente:** `modules/desarrollo-humano/services/estadisticas.service.js` — Endpoint: `GET /api/v1/admin/estadisticas`
- **Precondición:** Existen registros históricos de citas (atendidas, canceladas, no asistidas) y eventos en la base de datos.
- **Pasos de Ejecución:**
  1. Administrador consulta el tablero general y filtra por rango de fechas ISO (`desde` y `hasta`).
  2. Solicitar el informe de gestión en formato descargable (Excel y PDF).
  3. Intentar acceder con rol Estudiante.
- **Resultado Esperado:**
  - Consulta administrativa: Código HTTP **200 OK**, payload con total de citas, tasa de asistencia porcentual calculada, desglose por servicio y porcentaje de ocupación de talleres.
  - Descarga de reportes: Generación exitosa de binarios PDF (PDFKit) y hojas de cálculo XLSX (ExcelJS).
  - Estudiante: Código HTTP **403 Forbidden**.
- **Resultado Obtenido:** Métricas calculadas con precisión matemática verificadas; validación de rangos de fechas (rechazo si `desde > hasta`); RBAC respetado.
- **Evidencia Técnica:** Archivos `test/estadisticas.test.js` (Líneas 21-137) e `test/informe.test.js`.
- **Estado:** **Aprobado**.

---

#### CP-022: Atención presencial espontánea (sin cita), bloqueos de agenda y fotos de eventos
- **Requisito Asociado:** Requisitos Operativos de Desarrollo Humano | Historias: HU-006, HU-008, HU-020
- **Componente:** `sincita.test.js`, `bloqueos.test.js`, `eventos-imagen.test.js`
- **Precondición:** Administrador en sesión de atención diaria.
- **Pasos de Ejecución:**
  1. Registrar atención espontánea de estudiante que acude sin cita previa a orientación.
  2. Registrar un bloqueo de agenda (*«No estaré disponible»*) por incapacidad médica o reunión institucional.
  3. Subir afiche promocional de evento en formato JPG/PNG/WEBP (máx. 5 MB).
- **Resultado Esperado:**
  - Atención sin cita: Código HTTP **201 Created**, cita creada directamente en estado `Atendida` contabilizando en estadísticas.
  - Bloqueo de agenda: Código HTTP **201 Created**; los horarios que caigan dentro del rango bloqueado no pueden ser agendados (409).
  - Subida de imagen: Validación de tipo MIME y tamaño de archivo correcta.
- **Resultado Obtenido:** Operatividad diaria de la oficina de psicología validada y libre de fisuras.
- **Evidencia Técnica:** Archivos `test/sincita.test.js`, `test/bloqueos.test.js`, `test/eventos-imagen.test.js`.
- **Estado:** **Aprobado**.

---

### 5.3. Resumen Consolidado de Casos de Prueba Ejecutados

| ID Caso | Nombre del Caso de Prueba | Precondición Principal | Entrada / Acción | Resultado Esperado | Resultado Obtenido | Estado |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **CP-001** | Creación cuenta Google institucional | Correo `@uniautonoma.edu.co` nuevo | `POST /auth/google` con idToken válido | Código 200, JWT y rol Estudiante | Usuario creado con rol Estudiante y token | **Aprobado** |
| **CP-002** | Inicio y cierre de sesión | Usuario ya registrado | `GET /me` y luego `POST /logout` | 200 con datos; 401 sin token | Perfil retornado; 401 sin cabecera | **Aprobado** |
| **CP-003** | Rechazo cuentas no institucionales | Token con cuenta `@gmail.com` | `POST /auth/google` con cuenta externa | Código 403 Forbidden | Rechazado con 403; sin registro en BD | **Aprobado** |
| **CP-004** | Consulta horarios libres | Estudiante con sesión activa | `GET /citas/horarios-disponibles` | Lista de horarios libres futuros | Solo libres futuros; vacía si no hay | **Aprobado** |
| **CP-005** | Agendamiento y reserva de cupo | Horario libre y estudiante sin cita | `POST /citas` con horarioId | Código 201; horario ocupado; 409 duplicado | Cita Agendada creada; 409 colisión | **Aprobado** |
| **CP-006** | Consulta y cancelación propia (24h) | Cita agendada para dentro de 3 días | `PATCH /citas/:id/cancelar` | 200 y libera horario; 409 si <24h | Cita Cancelada; horario libre; 409 <24h | **Aprobado** |
| **CP-007** | Registro asistencia cita personal | Cita agendada y admin autenticado | `PATCH /admin/citas/:id/asistencia` | Estado Atendida / NoAsistio; 403 estudiante | Asistencia guardada; 403 a estudiante | **Aprobado** |
| **CP-008** | Gestión ciclo vida eventos | Admin autenticado | `POST/PATCH/DELETE /admin/eventos` | Borrador inicial; historial; confirma borrado| Creado en Borrador; auditoría en historial| **Aprobado** |
| **CP-009** | Inscripción a taller sin sobrecupo | Evento publicado con cupos | `POST /eventos/:id/inscripciones` | 201 y baja cupo; 409 duplicado o sin cupo | Inscripción confirmada; bloqueo sobrecupo | **Aprobado** |
| **CP-010** | Asistencia eventos solo inscritos | Evento con inscritos | `PATCH /inscripciones/:id/asistencia` | Asistencia guardada; 404 no inscrito | Registrada a inscritos; 404 ajenos | **Aprobado** |
| **CP-011** | Horarios del personal y agenda | Admin en panel de horarios | `POST/PATCH /admin/horarios` | 201 horario; 409 solape; cancela citas | Horario creado; solapes prevenidos | **Aprobado** |
| **CP-012** | Usuarios: roles y deshabilitación | SuperAdmin autenticado | `PATCH /admin/usuarios/:id/estado` | Usuario deshabilitado pierde acceso (401) | Pierde acceso de inmediato; salvaguardas | **Aprobado** |
| **CP-013** | Rutas por rol (RBAC) | Distintos tokens de prueba | `GET /admin/ping` | 401 anónimo; 403 estudiante; 200 admin | 401, 403 y 200 verificados | **Aprobado** |
| **CP-014** | Asistente IA seguro y líneas ayuda | Estudiante en chat de orientación | `POST /asistente/consultas` | Orienta; niega fármaco; da líneas 123/192 | Bloqueo ético y clínico local activo | **Aprobado** |
| **CP-015** | Resiliencia si n8n no está | Servidor n8n caído | `POST /citas` agendamiento | Cita guardada 201; error auditado en BD | Cita intacta; fallo registrado en admin | **Aprobado** |
| **CP-016** | Tablero analítica y reportes | Admin en dashboard | `GET /admin/estadisticas` | KPIs citas y eventos; Excel y PDF | Indicadores exactos; reportes descargables | **Aprobado** |
| **CP-022** | Atención sin cita y bloqueos | Operación diaria psicología | `POST /admin/sincita`, `/bloqueos` | Atención directa Atendida; agenda protegida| Registro exitoso; bloqueos efectivos | **Aprobado** |

---

## 6. Pruebas de Requisitos No Funcionales (RNF)

El 30 de octubre de 2026 se llevó a cabo una jornada de evaluación integral sobre el sistema desplegado en el banco de pruebas local (`http://localhost:4000` para el backend y `http://localhost:5173` para el frontend), sobre el commit `main` (`53a9235`). Para las pruebas de datos se utilizaron cuentas temporales con el prefijo `rnf.20261030` las cuales fueron depuradas al concluir las mediciones.

### 6.1. RNF-001: Rendimiento y Concurrencia Bajo Carga
- **Métrica Exigida en F-02:** Los listados del sistema deben responder en menos de 2.0 segundos ante una concurrencia de 50 usuarios simultáneos.
- **Procedimiento de Medición:** Se ejecutó un script automatizado que lanzó 50 peticiones HTTP concurrentes (`Promise.all`) autenticadas contra los endpoints de consulta de mayor demanda en la plataforma.
- **Resultados Consolidados:**

| Endpoint / Recurso Evaluado | Peticiones Exitosas | Latencia Mediana ($P_{50}$) | Peor Caso ($P_{100}$ / Max) | Cumplimiento (< 2.0 s) |
| :--- | :---: | :---: | :---: | :---: |
| **Eventos públicos** (`GET /eventos/publicos`) | 50 de 50 | **150 ms** | 249 ms | **Cumple Ampliamente** |
| **Servicios de orientación** (`GET /servicios`) | 50 de 50 | **157 ms** | 169 ms | **Cumple Ampliamente** |
| **Eventos del estudiante** (`GET /eventos`) | 50 de 50 | **147 ms** | 155 ms | **Cumple Ampliamente** |
| **Horarios libres** (`GET /citas/horarios-disponibles`) | 50 de 50 | **122 ms** | 136 ms | **Cumple Ampliamente** |
| **Mis citas** (`GET /citas/mias`) | 50 de 50 | **142 ms** | 153 ms | **Cumple Ampliamente** |
| **Grupos de Cultura** (`GET /cultura/grupos`) | 50 de 50 | **189 ms** | 199 ms | **Cumple Ampliamente** |
| **Agenda de Cultura** (`GET /cultura/eventos`) | 50 de 50 | **142 ms** | 159 ms | **Cumple Ampliamente** |
| **Oferta de Deporte** (`GET /deporte/grupos`) | 50 de 50 | **178 ms** | 187 ms | **Cumple Ampliamente** |

- **Diagnóstico y Estado:** **Aprobado**. En todos los casos el percentil más desfavorable (249 ms) se mantuvo casi una orden de magnitud por debajo del límite máximo tolerable de 2000 ms.

---

### 6.2. RNF-002: Seguridad, Autenticación y Autorización
- **Métrica Exigida en F-02:** Cifrado de contraseñas con `bcrypt` y protección absoluta de endpoints mediante tokens de sesión JWT.
- **Evaluación y Hallazgo Arquitectónico:**
  - El sistema cumple de forma sobresaliente la política de tokens: **ningún** endpoint privado puede ser accedido sin una cabecera `Authorization: Bearer <token>` válida (comprobado en CP-002, CP-004, CP-013, donde la omisión del token produce de forma invariable un código HTTP `401 Unauthorized`).
  - Sin embargo, respecto al almacenamiento de contraseñas con `bcrypt`, se identificó una divergencia arquitectónica positiva: durante el Sprint 1 se adoptó inicio de sesión federado exclusivo vía **Google OAuth 2.0 institucional**, prescindiendo de contraseñas locales para mitigar riesgos de filtración de credenciales. En consecuencia, el cifrado local con `bcrypt` quedó obsoleto por diseño.
- **Diagnóstico y Estado:** **Parcialmente Aprobado / Conforme por Evolución Arquitectónica**. La seguridad global es superior al estándar inicial al no almacenar secretos de usuario en la base de datos institucional.

---

### 6.3. RNF-003: Usabilidad y Eficiencia en el Agendamiento
- **Métrica Exigida en F-02:** Al menos el 90% de 10 usuarios evaluados debe completar exitosamente el proceso de agendamiento de una cita en menos de 3 minutos.
- **Procedimiento de Medición:**
  1. Se orquestó una prueba automatizada con 10 cuentas de prueba independientes (`rnf.20261030.01` a `.10`). Cada cuenta realizó la secuencia transaccional completa: autenticación, consulta de catálogo de servicios, selección de fecha, consulta de horarios disponibles, reserva de cita (`POST /citas`) y verificación en `Mis citas`.
  2. Adicionalmente, se cronometró la interacción manual de un usuario real en el frontend React siguiendo el flujo visual interactivo (*«Pedir una cita»* -> Seleccionar Orientación Psicológica -> Seleccionar fecha 16 de diciembre -> Seleccionar 11:00 a. m. -> Confirmar).
- **Resultados:**
  - **Prueba Transaccional:** **10 de 10 cuentas (100%)** lograron agendar su cita de manera exitosa (Código HTTP 201). La latencia transaccional de agendamiento en el servidor osciló entre **28 ms** (la más rápida) y **78 ms** (la más lenta).
  - **Prueba Interactiva en Interfaz:** El recorrido de usuario completo en pantalla se completó en un tiempo promedio de **45 a 55 segundos**, ampliamente inferior al umbral contractual de 180 segundos (3 minutos).
- **Diagnóstico y Estado:** **Aprobado** (en condiciones de laboratorio).

---

### 6.4. RNF-004: Mantenibilidad y Cobertura de Código
- **Métrica Exigida en F-02:** Cobertura de pruebas unitarias y de integración del backend $\ge 70\%$.
- **Resultados:**
  - Se cuenta con **18 suites de prueba activas** que agrupan un total de **197 casos de prueba automatizados**, todos ejecutándose de manera exitosa (100% *pass rate*) en aproximadamente 30.5 segundos.
  - La lógica de negocio crítica de los módulos de autenticación, citas, eventos, horarios y usuarios posee pruebas exhaustivas para todas sus ramas condicionales principales.
  - *Observación:* No se configuró en el comando `npm test` la generación formal del informe de cobertura de código mediante herramientas como `istanbul` / `c8` (`jest --coverage`), por lo cual no se cuenta con el porcentaje numérico formalmente certificado.
- **Diagnóstico y Estado:** **Pendiente de Medición Formal** (197 casos operando satisfactoriamente).

---

### 6.5. RNF-005: Compatibilidad Cross-Browser y Multi-dispositivo (Responsive)
- **Métrica Exigida en F-02:** Funcionamiento verificado en Google Chrome, Microsoft Edge y Mozilla Firefox, tanto en estación de trabajo de escritorio como en vista móvil.
- **Resultados de la Evaluación (30 de octubre de 2026):**

| Navegador / Motor | Entorno de Ejecución | Vista de Escritorio ($1366 \times 768$) | Vista Móvil ($390 \times 844$) | Diagnóstico |
| :--- | :--- | :--- | :--- | :---: |
| **Google Chrome** | Local (Motor Blink v129) | Portal renderiza portada 3D, catálogo de módulos y botón de inicio de sesión sin desbordamientos. | Menú hamburguesa funcional, tarjetas de módulos adaptadas en una columna vertical legible. | **Aprobado** |
| **Microsoft Edge** | Local (Motor Blink v129) | Renderizado idéntico a Google Chrome, soporte tipográfico y transiciones CSS fluidas. | Adaptabilidad responsive correcta, formulario de agendamiento sin recortes visuales. | **Aprobado** |
| **Mozilla Firefox 157**| Motor Gecko (vía Playwright) | Escena Three.js y layout Flexbox/Grid alineados correctamente; botón Google OAuth íntegro. | Las cinco dimensiones de Bienestar visibles; scroll táctil simulado sin bloqueos. | **Aprobado** |

- **Salvedad Técnica:** La prueba móvil se efectuó mediante la emulación estricta del viewport ($390 \times 844$ px) en el motor de navegación, no en un dispositivo telefónico físico conectado a la red Wi-Fi universitaria.
- **Diagnóstico y Estado:** **Aprobado**.

---

### 6.6. RNF-006: Confiabilidad, Disponibilidad y Respaldo
- **Métrica Exigida en F-02:** Disponibilidad del servicio $\ge 95\%$ y política de respaldo diario automatizado de base de datos.
- **Resultados:** El proyecto se encuentra actualmente probado y estabilizado en el entorno de desarrollo y laboratorio local. No se ha realizado aún el despliegue formal en infraestructura de producción (ej. Render, Vercel o Supabase) con servicios de monitoreo continuo de disponibilidad ni cron jobs de respaldo automatizado de PostgreSQL.
- **Diagnóstico y Estado:** **No Medido en Producción**.

---

## 7. Registro de Defectos y Desviaciones Encontradas

A continuación se consolidan los hallazgos, desviaciones respecto a los documentos iniciales y oportunidades de mejora identificadas durante las fases de verificación y validación:

| Código | Requisito / HU | Tipo de Hallazgo | Descripción Detallada | Nivel de Severidad | Estado / Plan de Acción |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **DEF-001** | RNF-002 | Desviación Contractual | El F-02 estipulaba el uso de `bcrypt` para contraseñas locales. Al migrar a Google OAuth 2.0 federado, no existen contraseñas en la base de datos. | **Baja** (Mejora de Seguridad) | **Aceptado / Documentado:** La arquitectura actual es superior al eliminar contraseñas locales. Se actualiza el manual de especificación. |
| **DEF-002** | RNF-004 | Omisión de Métrica | No se parametrizó la bandera `--coverage` en el script `test` de `package.json`, impidiendo la generación del reporte HTML/LCOV de cobertura. | **Media** (Aseguramiento de Calidad) | **Abierto / En Proceso:** Se incorporará el comando `npm run test:coverage` para auditar formalmente el porcentaje exacto de cobertura. |
| **DEF-003** | RNF-006 | Infraestructura Pendiente | No existe un ambiente de producción activo que permita certificar el SLA del 95% ni la ejecución de backups periódicos programados. | **Media** (Operacional) | **Pendiente de Despliegue:** Se configurará en la fase de puesta en producción sobre Supabase/Render. |
| **DEF-004** | HU-008 (F-02) | Discrepancia Funcional | Al deshabilitar un usuario en el panel administrativo, el sistema no solicita confirmación en caso de que dicho usuario posea citas activas agendadas. | **Baja** (Usabilidad Administrativa) | **Pendiente de Ajuste:** Actualmente el usuario deshabilitado pierde el acceso inmediatamente (401), pero sus citas quedan agendadas hasta que el personal las libere. |
| **DEF-005** | RNF-005 | Salvedad de Prueba | Las pruebas en dispositivos móviles se realizaron en emuladores de ventana ($390 \times 844$) y no sobre terminales físicos iOS / Android. | **Baja** (Entorno de Pruebas) | **Mitigado:** Se programa sesión de pruebas piloto con usuarios reales portando smartphones antes del lanzamiento masivo. |

---

## 8. Guía de Ejecución de Pruebas

Para reproducir de forma fidedigna los resultados documentados en este anexo, siga las instrucciones técnicas descritas a continuación.

### 8.1. Requisitos Previos
- Node.js versión 18.x o superior instalado en el sistema operativo.
- Gestor de paquetes npm configurado.
- Clon del repositorio en rama `main` ubicado en la ruta del proyecto.

### 8.2. Comandos de Ejecución

1. **Ubicarse en el directorio del Backend:**
   ```bash
   cd conecta-bu/backend
   ```

2. **Instalar dependencias del proyecto (incluye Jest y Supertest):**
   ```bash
   npm install
   ```

3. **Ejecutar la totalidad de las suites de prueba automatizadas:**
   ```bash
   npm test
   ```
   *Salida esperada:*
   ```text
   PASS test/auth.test.js
   PASS test/citas.test.js
   PASS test/eventos.test.js
   PASS test/horarios.test.js
   PASS test/usuarios.test.js
   PASS test/asistente.test.js
   PASS test/estadisticas.test.js
   ... (18 suites completas)

   Test Suites: 18 passed, 18 total
   Tests:       197 passed, 197 total
   Snapshots:   0 total
   Time:        30.521 s
   Ran all test suites.
   ```

4. **Ejecutar suites específicas con control de terminación:**
   - Para probar exclusivamente el módulo de autenticación:
     ```bash
     npx jest test/auth.test.js --watchman=false --forceExit
     ```
   - Para probar el agendamiento y cancelación de citas:
     ```bash
     npx jest test/citas.test.js --watchman=false --forceExit
     ```
   - Para evaluar el asistente de inteligencia artificial y resiliencia de n8n:
     ```bash
     npx jest test/asistente.test.js --watchman=false --forceExit
     ```

5. **Generar informe consolidado de cobertura de código (LCOV / HTML):**
   ```bash
   npx jest --coverage --watchman=false --forceExit
   ```
   *El reporte detallado se generará de manera interactiva en la carpeta `backend/coverage/lcov-report/index.html`.*

---

## 9. Conclusiones y Dictamen de Calidad

Tras la culminación rigurosa de las pruebas unitarias, de integración, funcionales, de carga y de compatibilidad, el equipo de desarrollo y aseguramiento de calidad concluye lo siguiente:

1. **Alineación con los Requisitos Funcionales del F-02:** Los diez requisitos funcionales estipulados en el documento de especificación F-02 (RF-001 al RF-010) se encuentran plenamente implementados, verificados y aprobados mediante pruebas automatizadas sobre la API REST. La plataforma demostró solidez en el control de cupos, prevención de duplicados, aislamiento de citas por usuario y aplicación de roles RBAC.
2. **Robustez y Resiliencia Arquitectónica:** Las pruebas demostraron que Conecta BU cuenta con una alta tolerancia a fallos. La desconexión intencionada de servicios externos (como los flujos de n8n o la API externa de Gemini) no degrada la integridad de los datos ni impide que los estudiantes completen sus trámites de agendamiento o inscripción.
3. **Rendimiento Excepcional en Carga Concurrente:** El backend demostró una capacidad sobresaliente al responder a 50 peticiones concurrentes en menos de 250 milisegundos en su caso más desfavorable, superando ampliamente la exigencia contractual de 2.0 segundos.
4. **Seguridad y Privacidad Institucional:** La adopción del protocolo Google OAuth2 federado bajo el dominio `@uniautonoma.edu.co` garantiza un control de acceso centralizado y seguro, complementado con filtros éticos locales en el asistente IA que impiden la emisión de diagnósticos clínicos y salvaguardan la privacidad del estudiante.
5. **Dictamen Final:** El módulo de **Desarrollo Humano** de **Conecta BU** se declara **APROBADO TÉCNICAMENTE** para su despliegue y validación en la fase de prueba piloto con usuarios de la comunidad universitaria de la Uniautónoma.

---

*Documento elaborado y validado para la cátedra de Sistemas de Información Empresarial (SIE), Popayán, Cauca, 2026.*
