# Plan y ejecución de pruebas — Conecta BU

Documento de pruebas del producto Conecta BU (Ingeniería de Software, 2026-2). Reúne el plan y lo que ya se ejecutó: pruebas de la API, la medición de carga y la revisión en navegadores. Las fuentes detalladas son `docs/BITACORA-DE-PRUEBAS.md` y la carpeta `backend/test`.

## 1. Alcance y ambiente

| Campo | Dato |
|---|---|
| Producto | Conecta BU, portal de Bienestar Institucional |
| Código revisado | `main`, commit `dbe4f07` (10 de noviembre de 2026) |
| Cliente citado en el F-00 | Ancizar Paz, Bienestar — Área de Psicología |
| Equipo | Carlos Santiago Torres Castrillón y Luisa Jhulieth Joaqui |

El F-02 pide pruebas sobre el sistema desplegado. **Ese ambiente no existe.** No hay dominio, HTTPS ni servidor de la universidad. Todo lo ejecutado corrió en el computador de desarrollo:

- Sitio: `http://localhost:5173`
- API: `http://localhost:4000`
- Base: PostgreSQL local, `conecta_bu`
- Las pruebas automáticas no usan esa base: Jest simula PostgreSQL y Google

Por eso este documento no presenta una aceptación de usuario sobre un sistema publicado.

## 2. Tipos de prueba

| Tipo | Qué se hizo | Qué no se hizo |
|---|---|---|
| Unitarias | Hay funciones puras cubiertas de paso dentro de los archivos de `backend/test` (validaciones de cupo, horario, dominio). No hay una suite separada de funciones aisladas. | Informe de cobertura (RNF-004, meta 70 %). No se midió. |
| Integración de API | Jest y Supertest llaman las rutas HTTP con la base simulada. Es el grueso de `backend/test`. | No se repitió la suite completa el 10 de noviembre de 2026. |
| Rendimiento | Carga de 50 sesiones y 10 agendamientos, el 30 de octubre de 2026, contra el API local. | No se midió un servidor publicado ni la red de la universidad. |
| Aceptación de usuario (UAT) | Hay un recorrido de pantalla de «Pedir una cita» hecho por el equipo, el 30 de octubre. | No hay acta de usuarios de Bienestar usando un sistema desplegado. |

## 3. Plan

### 3.1 Integración de la API

Comando, desde `conecta-bu/backend`:

```
npm test
```

Cada archivo de `backend/test` cubre un módulo. El criterio de aprobación es que la respuesta HTTP y el estado esperado coincidan (201 al crear, 409 al repetir o llenar el cupo, 401 sin token, 403 sin el módulo).

| Archivo | Qué debe cumplir |
|---|---|
| `auth.test.js` | Correo institucional entra; otro dominio no; cierre de sesión |
| `citas.test.js` | Horario libre, un solo cupo, cancelación |
| `horarios.test.js` | El personal publica y deshabilita horarios |
| `eventos.test.js` | Publicar, inscribir sin duplicar, asistencia solo de inscritos |
| `usuarios.test.js`, `super.test.js` | Rol, estado y accesos por módulo |
| `salud.test.js`, `jornadas.test.js`, `informe.test.js`, `sst.test.js`, `salidas.test.js` | Registro, evidencias, informe y salidas |
| `deporte.test.js` y los de imágenes, PISU y tablero | Grupos, cupo, cruce de horario y horas |
| `cultura*.test.js` | Grupos, agenda, convocatorias, roles, SNIES, logística e informe |
| `notificaciones.test.js` | Aviso creado, listado y marca de leído |
| `asistente.test.js` | El asistente no diagnostica y responde sobre Bienestar |
| `limite-peticiones.test.js` | El límite de peticiones responde cuando se supera |

### 3.2 Rendimiento (RNF-001 y RNF-003)

- 50 sesiones piden a la vez los listados públicos y los del estudiante. Todas deben responder en menos de 2 segundos.
- 10 cuentas recorren servicios, horarios, agendar y «Mis citas». Al menos 9 de 10 deben terminar en menos de 3 minutos.

### 3.3 Navegadores (RNF-005)

Chrome, Edge y Firefox, en ventana de escritorio (1366×768) y en ventana de celular (390×844). El ingreso y el portal deben mostrar el botón de Google y las dimensiones sin recortar el botón.

### 3.4 Aceptación de usuario

Cuando exista un ambiente publicado, una persona de cada rol debe completar, sin ayuda del equipo de desarrollo:

1. Estudiante: entrar, pedir una cita, inscribirse a un taller, ver horas de deporte y abrir Arte y Cultura.
2. Personal de un módulo: entrar al panel que le asignaron, registrar una asistencia y salir.
3. Superadministrador: asignar un acceso y ver que esa persona entra al módulo.

El resultado se anota como aprobado solo si la persona lo termina sola. Hoy esa sesión **no se ha hecho**.

## 4. Ejecución registrada

### 4.1 API, 13 de octubre de 2026

Build `0b5930b`. Comando `npm test`.

| Resultado | Cantidad |
|---|---|
| Suites | 18 de 18 |
| Casos | 197 de 197 |
| Tiempo | 30,5 s |

Los diez requisitos funcionales del F-02 tienen caso (CP-001 a CP-013) y salieron aprobados, con estas salvedades ya escritas en la bitácora: el registro es con Google y no con contraseña; cancelar una cita exige 24 horas; desactivar un usuario no pide confirmación por citas activas.

El detalle de cada caso está en la bitácora, secciones 3 y 4.

### 4.2 Arte y Cultura, 30 de octubre de 2026

Build `53a9235`. Comando:

```
npx jest test/cultura.test.js test/cultura-hu.test.js --watchman=false --forceExit
```

8 de 8 casos aprobados (CP-023 a CP-030), en 6,6 s. Cubren inscripción, cupo, horario cruzado, agenda, convocatoria, asistencia con tipo SNIES, hora e IP, el rol monitor, ASIES, pausa, apoyo, cédula y los informes. La subida de la foto o el PDF y la segunda franja del mismo día no tuvieron caso automático.

Después de esa fecha el repositorio sumó más archivos (`cultura-equipo`, `cultura-informe`, `cultura-logistica`, `cultura-ubicacion`, `cultura-ventana`, `cultura-snies-fechas`, `notificaciones`). Esos archivos están en el plan. **No se volvió a correr la suite completa para este documento.**

### 4.3 Rendimiento y navegadores, 30 de octubre de 2026

Contra el API y el sitio encendidos en este equipo. Las cuentas de prueba se borraron al terminar.

| Prueba | Resultado | Límite |
|---|---|---|
| RNF-001, 50 peticiones simultáneas a 8 listados | 50 de 50 en cada uno. Peor caso: 249 ms (eventos públicos) | Menos de 2 s |
| RNF-003, 10 agendamientos por la API | 10 de 10, entre 28 ms y 78 ms | 9 de 10 en menos de 3 min |
| RNF-003, un recorrido en pantalla | Orientación psicológica, 16 de diciembre de 2026, 11:00, confirmada en Mis citas | Cabe en 3 min |
| RNF-005 | Chrome y Edge instalados. Firefox 157 con Playwright, porque el equipo no tiene Firefox. Ventana 390×844, no un teléfono | Los tres motores mostraron el ingreso |

Esto aprueba el laboratorio. No aprueba un servidor publicado.

### 4.4 Lo que sigue sin ejecutarse

| ID | Qué pide el F-02 | Estado al 10 de noviembre de 2026 |
|---|---|---|
| RNF-002 | Contraseñas con bcrypt | Parcial. No hay contraseñas. Sin JWT la API responde 401. |
| RNF-004 | Cobertura ≥ 70 % | No medida. |
| RNF-006 | Disponibilidad ≥ 95 % y respaldo diario | No ejecutada. No hay servidor publicado ni copia diaria. |
| UAT | Usuarios reales sobre el sistema desplegado | No ejecutada. No hay despliegue. |

## 5. Criterio de cierre

La ejecución de laboratorio cierra los requisitos funcionales del F-02 y los casos de Cultura del 30 de octubre. No cierra la aceptación de usuario ni el requisito de disponibilidad. Esos dos quedan abiertos hasta que la universidad publique el sitio y alguien de Bienestar recorra los tres papeles de la sección 3.4.
