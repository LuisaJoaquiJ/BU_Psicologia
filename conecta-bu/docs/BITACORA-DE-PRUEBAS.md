# Bitácora de pruebas — Conecta BU

Cierra la matriz de trazabilidad del numeral 8 del F-02, que dejaba los casos «por definir en F-05». Los identificadores de requisito son los del F-02. El resultado automático es el de la ejecución del 13 de octubre de 2026.

## 1. Identificación

| Campo | Dato |
|---|---|
| Proyecto | Conecta DH en el F-00; producto probado: Conecta BU |
| Cliente | Ancizar Paz, Bienestar — Área de Psicología |
| Responsable de calidad (F-00) | Luisa Jhulieth Joaqui |
| Líder técnico (F-00) | Carlos Santiago Torres Castrillón |
| Periodo | 2026-2 |
| Build probado | `main`, commit `0b5930b` |
| Fecha de esta ejecución | 13 de octubre de 2026 |

## 2. Cómo se probó

Las pruebas automáticas están en `conecta-bu/backend/test`. Usan Jest y simulan PostgreSQL y Google, así que no tocan la base real. Comando: `npm test` en `backend`.

| Resultado | Cantidad |
|---|---|
| Suites | 18 de 18 aprobadas |
| Casos | 197 de 197 aprobados |
| Tiempo | 30,5 s |

Eso comprueba la API. No comprueba la prueba piloto de usabilidad ni la carga de 50 usuarios del F-02.

Además, el 13 de octubre de 2026 se abrió la aplicación en el navegador con la cuenta `carlos.torres.c@uniautonoma.edu.co`. Google aceptó el ingreso (`POST /api/v1/auth/google` respondió 200) y cargaron eventos, citas y horas de deporte.

## 3. Matriz de trazabilidad del F-02

| Requisito | Historia | Componente | Caso | Resultado |
|---|---|---|---|---|
| RF-001 Registro | HU-001 | `auth.service` + login | CP-001 | Aprobado, con el cambio de mecanismo de la bitácora de desarrollo |
| RF-002 Inicio de sesión | HU-002 | `auth` + `LoginPage` | CP-002, CP-003 | Aprobado |
| RF-003 Horarios disponibles | HU-003 | `citas` + agendar | CP-004 | Aprobado |
| RF-004 Agendamiento | HU-004 | `citas` | CP-005 | Aprobado |
| RF-005 Mis citas y cancelación | HU-005 | `citas` + Mis citas | CP-006 | Aprobado |
| RF-006 Asistencia a citas | (incluida en HU-004) | agenda del personal | CP-007 | Aprobado |
| RF-007 Gestión de eventos | HU-006 | `eventos` admin | CP-008 | Aprobado |
| RF-008 Inscripción a eventos | HU-007 | `eventos` estudiante | CP-009 | Aprobado |
| RF-009 Asistencia a eventos | (incluida en HU-006) | inscritos del evento | CP-010 | Aprobado |
| RF-010 Usuarios y horarios | HU-008 | horarios y usuarios | CP-011, CP-012 | Aprobado |

## 4. Casos del alcance del F-02

### CP-001 — La cuenta se crea al entrar con el correo institucional

- **Requisito:** RF-001
- **Dado** un correo `@uniautonoma.edu.co` que no existe en la base.
- **Cuando** el backend recibe un token de Google válido.
- **Entonces** crea el usuario con rol Estudiante y devuelve un JWT.
- **Evidencia:** `test/auth.test.js` («inicio de sesion institucional»).
- **Resultado:** Aprobado. No se probó un formulario de registro con contraseña porque el producto no lo tiene.

### CP-002 — Inicio de sesión y cierre

- **Requisito:** RF-002
- **Dado** un usuario ya creado.
- **Cuando** consulta `/auth/me` con su token, y cuando cierra sesión.
- **Entonces** `/me` devuelve su rol y, sin token, la ruta protegida responde 401.
- **Evidencia:** `test/auth.test.js`. Manual: ingreso real del 13 de octubre de 2026, respuesta 200.
- **Resultado:** Aprobado. El F-02 pedía correo y contraseña; aquí la credencial es la cuenta de Google.

### CP-003 — Una cuenta de otro dominio no entra

- **Requisito:** RF-002, y la restricción de dominio que el código llama RN-001
- **Cuando** el token de Google trae un correo `@gmail.com`.
- **Entonces** el sistema rechaza el ingreso y no crea usuario.
- **Evidencia:** `test/auth.test.js`.
- **Resultado:** Aprobado.

### CP-004 — El estudiante ve horarios libres

- **Requisito:** RF-003
- **Dado** un estudiante autenticado y horarios publicados.
- **Cuando** consulta los horarios de un servicio.
- **Entonces** ve los disponibles y, si no hay, el listado va vacío.
- **Evidencia:** `test/citas.test.js`.
- **Resultado:** Aprobado.

### CP-005 — Agendar ocupa el cupo una sola vez

- **Requisito:** RF-004 y RN-003
- **Cuando** el estudiante confirma un horario libre.
- **Entonces** la cita queda registrada y el horario deja de ofrecerse. Un segundo intento sobre el mismo cupo no crea otra cita.
- **Evidencia:** `test/citas.test.js`.
- **Resultado:** Aprobado.

### CP-006 — Ver y cancelar la cita propia

- **Requisito:** RF-005
- **Cuando** el estudiante abre «Mis citas» y cancela con más de 24 horas de anticipación.
- **Entonces** la cita pasa a cancelada y el horario vuelve a estar libre. Con menos de 24 horas, la cancelación se rechaza.
- **Evidencia:** `test/citas.test.js`.
- **Resultado:** Aprobado. El plazo de 24 horas es una regla añadida; el F-02 no la pedía.

### CP-007 — El personal registra la asistencia a la cita

- **Requisito:** RF-006
- **Dado** un administrador autenticado y una cita existente.
- **Cuando** la marca como asistió o no asistió.
- **Entonces** el estado queda guardado. Un estudiante que llama el mismo endpoint recibe 403.
- **Evidencia:** `test/horarios.test.js`.
- **Resultado:** Aprobado.

### CP-008 — El personal gestiona eventos

- **Requisito:** RF-007
- **Cuando** crea, edita, publica o elimina un evento.
- **Entonces** el evento nuevo queda en borrador salvo que se publique de una vez. Si tiene inscritos, borrarlo exige confirmación.
- **Evidencia:** `test/eventos.test.js`.
- **Resultado:** Aprobado.

### CP-009 — El estudiante se inscribe sin duplicar ni pasar el cupo

- **Requisito:** RF-008, RN-002 y RN-003
- **Cuando** se inscribe a un evento publicado con cupo.
- **Entonces** la inscripción queda y el cupo baja. Una segunda inscripción al mismo evento no se duplica. Sin cupo, se rechaza.
- **Evidencia:** `test/eventos.test.js`.
- **Resultado:** Aprobado.

### CP-010 — Asistencia solo de inscritos

- **Requisito:** RF-009
- **Cuando** el personal marca la asistencia de una inscripción.
- **Entonces** queda registrada. No se marca asistencia de quien no está inscrito.
- **Evidencia:** `test/eventos.test.js`.
- **Resultado:** Aprobado.

### CP-011 — Horarios del personal

- **Requisito:** RF-010 (parte de horarios)
- **Cuando** el administrador crea, modifica o deshabilita un horario.
- **Entonces** el cambio queda y el estudiante deja de ver el horario deshabilitado.
- **Evidencia:** `test/horarios.test.js`.
- **Resultado:** Aprobado.

### CP-012 — Usuarios: rol y estado

- **Requisito:** RF-010 (parte de usuarios)
- **Cuando** el superadministrador busca un usuario, le cambia el rol o lo deshabilita.
- **Entonces** el cambio se guarda. Nadie puede deshabilitarse a sí mismo ni dejar el sistema sin un administrador habilitado. Un usuario deshabilitado pierde el acceso en la siguiente petición.
- **Evidencia:** `test/usuarios.test.js`.
- **Resultado:** Aprobado. El F-02 pedía confirmar si el usuario tiene citas activas; esa confirmación no está en la prueba ni en esa regla.

### CP-013 — Rutas según el rol

- **Requisito:** RF-002 y el numeral 7.1 del F-00 (estudiante y administrador)
- **Cuando** un estudiante llama `GET /api/v1/admin/ping`.
- **Entonces** responde 403. Sin token, 401. Con token de administrador, 200.
- **Evidencia:** `test/auth.test.js`.
- **Resultado:** Aprobado.

## 5. Casos de lo construido fuera del F-02

Estas funciones no están en el acta. Se probaron porque están en el repositorio.

| Caso | Qué comprueba | Archivo | Resultado |
|---|---|---|---|
| CP-014 | El asistente responde dudas de Bienestar, niega diagnóstico y medicamento, y ante una crisis entrega las líneas de ayuda sin llamar al modelo | `asistente.test.js` | Aprobado |
| CP-015 | Si n8n no está, la cita o la inscripción igual se guarda | `asistente.test.js` | Aprobado |
| CP-016 | El tablero filtra por fechas y el informe sale en Excel o PDF | `estadisticas.test.js`, `informe.test.js` | Aprobado |
| CP-017 | Salud: solo entra el personal asignado; registro por documento, actividades, reportes e importación | `salud.test.js` | Aprobado |
| CP-018 | Informe de gestión: el módulo lo envía y el superadministrador lo aprueba o lo devuelve | `informe-gestion.test.js` | Aprobado |
| CP-019 | Salidas institucionales: radicación, documentos y revisión | `sst.test.js`, `salidas.test.js` | Aprobado |
| CP-020 | Deporte: grupos, cupo, cruce de horario, asistencia y horas | `deporte.test.js` | Aprobado |
| CP-021 | El superadministrador asigna módulos y ve el tablero general | `super.test.js` | Aprobado |
| CP-022 | Atención de quien llega sin cita, tiempo no disponible y foto del evento | `sincita.test.js`, `bloqueos.test.js`, `eventos-imagen.test.js` | Aprobado |

## 6. Requisitos no funcionales del F-02

| ID | Métrica del F-02 | Resultado el 13 de octubre de 2026 |
|---|---|---|
| RNF-001 | Listados en menos de 2 s con 50 usuarios concurrentes | No ejecutada. No hay prueba de carga. |
| RNF-002 | Contraseñas con bcrypt y ningún endpoint protegido sin JWT | Parcial. No hay contraseñas. Sí se comprobó que sin JWT la respuesta es 401 (CP-013). |
| RNF-003 | 90 % de 10 usuarios agenda una cita en menos de 3 minutos | No ejecutada. No hubo prueba piloto. |
| RNF-004 | Cobertura de pruebas del backend ≥ 70 % | No medida. Hay 197 casos, sin informe de cobertura. |
| RNF-005 | Chrome, Edge y Firefox, en computador y en la vista de celular | Parcial. El 13 de octubre de 2026 se abrió en el navegador de este equipo. No quedó constancia en Edge, Firefox ni en el celular. |
| RNF-006 | Disponibilidad ≥ 95 % y respaldo diario | No ejecutada. Corre en local, sin respaldo programado. |

## 7. Lectura

Los diez requisitos funcionales del F-02 tienen caso y salieron aprobados en la API, con tres salvedades ya escritas: el registro es por Google y no por contraseña, la cancelación exige 24 horas, y desactivar un usuario no pide confirmación por citas activas.

Los requisitos no funcionales del F-02, salvo la parte de JWT del RNF-002, no quedaron demostrados en esta ejecución.
