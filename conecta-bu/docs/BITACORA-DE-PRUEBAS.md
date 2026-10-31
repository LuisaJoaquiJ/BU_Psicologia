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

El texto de cada historia (incluida la de la IA, HU-012) está en `docs/HISTORIAS-DE-USUARIO.md`.

## 3. Matriz de trazabilidad del F-02

| Requisito | Historia | Componente | Caso | Resultado |
|---|---|---|---|---|
| RF-001 Registro | HU-001 | `auth.service` + login | CP-001 | Aprobado, con el cambio de mecanismo de la bitácora de desarrollo |
| RF-002 Inicio de sesión | HU-002 | `auth` + `LoginPage` | CP-002, CP-003 | Aprobado |
| RF-003 Horarios disponibles | HU-003 | `citas` + agendar | CP-004 | Aprobado |
| RF-004 Agendamiento | HU-004 | `citas` | CP-005 | Aprobado |
| RF-005 Mis citas y cancelación | HU-005 | `citas` + Mis citas | CP-006 | Aprobado |
| RF-006 Asistencia a citas | HU-009 | agenda del personal | CP-007 | Aprobado |
| RF-007 Gestión de eventos | HU-006 | `eventos` admin | CP-008 | Aprobado |
| RF-008 Inscripción a eventos | HU-007 | `eventos` estudiante | CP-009 | Aprobado |
| RF-009 Asistencia a eventos | HU-010 | inscritos del evento | CP-010 | Aprobado |
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
| RNF-001 | Listados en menos de 2 s con 50 usuarios concurrentes | Aprobado el 30 de octubre de 2026, en este equipo. Sección 9. |
| RNF-002 | Contraseñas con bcrypt y ningún endpoint protegido sin JWT | Parcial. No hay contraseñas. Sí se comprobó que sin JWT la respuesta es 401 (CP-013). |
| RNF-003 | 90 % de 10 usuarios agenda una cita en menos de 3 minutos | Aprobado el 30 de octubre de 2026: 10 de 10. Es una prueba de laboratorio, no una sesión con diez personas de la universidad. Sección 9. |
| RNF-004 | Cobertura de pruebas del backend ≥ 70 % | No medida. Hay 197 casos, sin informe de cobertura. |
| RNF-005 | Chrome, Edge y Firefox, en computador y en la vista de celular | Aprobado el 30 de octubre de 2026. Chrome y Edge instalados en el equipo; Firefox 157 abierto con el motor de Playwright porque el equipo no tiene Firefox instalado. La vista de celular es una ventana de 390×844, no un teléfono físico. Sección 9. |
| RNF-006 | Disponibilidad ≥ 95 % y respaldo diario | No ejecutada. Corre en local, sin respaldo programado. |

## 7. Lectura

Los diez requisitos funcionales del F-02 tienen caso y salieron aprobados en la API, con tres salvedades ya escritas: el registro es por Google y no por contraseña, la cancelación exige 24 horas, y desactivar un usuario no pide confirmación por citas activas.

Los requisitos no funcionales del F-02, salvo la parte de JWT del RNF-002, no quedaron demostrados en esta ejecución.

## 8. Arte y Cultura — ejecución del 30 de octubre de 2026

Fuera del F-02. Cubre la historia HU-021 y el mapa HU-01 a HU-13 de la ficha del área. El código probado es `main` en el commit `53a9235`. Las pruebas simulan PostgreSQL y no tocan la base real.

Comando, desde `conecta-bu/backend`:

```
npx jest test/cultura.test.js test/cultura-hu.test.js --watchman=false --forceExit
```

| Resultado | Cantidad |
|---|---|
| Suites | 2 de 2 aprobadas |
| Casos | 8 de 8 aprobados |
| Tiempo | 6,6 s |

| Caso | Qué comprueba | Historia | Archivo | Resultado |
|---|---|---|---|---|
| CP-023 | Inscripción a un grupo, rechazo del duplicado y retiro que libera el cupo | HU-021, HU-01 | `cultura.test.js` | Aprobado |
| CP-024 | Sin cupo responde 409. Un horario que se cruza con otro grupo del mismo periodo también responde 409 | HU-021, HU-03 | `cultura.test.js` | Aprobado |
| CP-025 | La agenda publicada acepta una inscripción y rechaza la que pasa el cupo | HU-021, HU-05 | `cultura.test.js` | Aprobado |
| CP-026 | La postulación exige motivación. Queda Recibida. Quien no tiene el módulo recibe 403. El personal la pasa a Aceptada | HU-021 | `cultura.test.js` | Aprobado |
| CP-027 | El personal publica un grupo e inscribe la asistencia de quien está inscrito | HU-021, HU-07 | `cultura.test.js` | Aprobado |
| CP-028 | La inscripción y el auto-registro de asistencia guardan tipo SNIES 2, fecha y hora, e IP. Una segunda marca el mismo día responde 409. El informe SNIES sale en Excel | HU-07, HU-09 | `cultura.test.js` | Aprobado |
| CP-029 | El monitor no crea grupos (403). Una representación ASIES guarda la red, la posición y al participante, y se consulta en el histórico | HU-02, HU-12, HU-13 | `cultura-hu.test.js` | Aprobado |
| CP-030 | La pausa creativa y el apoyo a mercadeo quedan registrados. El perfil guarda cédula, programa Derecho y caracterización Afro. La búsqueda por cédula encuentra al inscrito. El registro calificado confirma la asistencia. El informe de inclusión cuenta Afro. El CSV del SNIES incluye el programa | HU-04, HU-06, HU-07, HU-10, HU-11 | `cultura-hu.test.js` | Aprobado |

### CP-023 — Inscripción, duplicado y retiro

- **Dado** un grupo activo con inscripciones abiertas.
- **Cuando** el estudiante se inscribe, lo intenta otra vez y luego se retira.
- **Entonces** la primera respuesta es 200, la segunda es 409 y, al retirarse, el cupo ocupado vuelve a cero.
- **Evidencia:** `test/cultura.test.js` («el estudiante se inscribe, no repite y se retira»).
- **Resultado:** Aprobado.

### CP-024 — Cupo y horario cruzado

- **Dado** un grupo con cupo 1 ya ocupado, y otro par de grupos cuyo horario se solapa.
- **Cuando** una segunda persona pide el cupo lleno, o la misma persona pide el grupo que se cruza.
- **Entonces** ambas peticiones responden 409.
- **Evidencia:** `test/cultura.test.js` («no hay cupo ni horario cruzado»).
- **Resultado:** Aprobado.

### CP-025 — Agenda con cupo

- **Dado** un evento publicado, con cupo 1 y fecha límite futura.
- **Cuando** dos estudiantes se inscriben.
- **Entonces** el primero entra y el segundo recibe 409.
- **Evidencia:** `test/cultura.test.js` («la agenda respeta cupo y fecha límite»).
- **Resultado:** Aprobado.

### CP-026 — Convocatoria

- **Cuando** el estudiante postula con una motivación de una palabra, y luego con un texto suficiente.
- **Entonces** la corta responde 400 y la válida queda en estado Recibida. Un administrador de otro módulo no lista las postulaciones (403). El personal de Cultura la acepta.
- **Evidencia:** `test/cultura.test.js` («la convocatoria se postula y el personal la acepta»).
- **Resultado:** Aprobado.

### CP-027 — Publicar grupo y pasar asistencia

- **Cuando** el personal crea el grupo y marca presente a quien ya se inscribió.
- **Entonces** el grupo responde 201 y la asistencia cuenta un presente.
- **Evidencia:** `test/cultura.test.js` («el personal publica un grupo y marca asistencia»).
- **Resultado:** Aprobado.

### CP-028 — Auditoría SNIES

- **Cuando** el estudiante se inscribe como tipo SNIES 2 y marca su propia asistencia.
- **Entonces** la inscripción y la asistencia guardan el tipo 2, la fecha y hora, y la IP. Repetir la asistencia el mismo día responde 409. El informe del área se descarga como hoja de cálculo.
- **Evidencia:** `test/cultura.test.js` («la inscripcion y la asistencia guardan tipo, hora e IP»).
- **Resultado:** Aprobado. Los códigos de esta ficha son 1 Estudiante, 2 Docente, 3 Administrativo y 4 Egresado.

### CP-029 — Monitor y red ASIES

- **Cuando** el personal deja a un correo como monitor y ese monitor intenta crear un grupo. Luego el personal registra una representación ASIES con posición y el correo del participante.
- **Entonces** crear el grupo responde 403. La representación responde 201 y el histórico de esa persona devuelve una fila.
- **Evidencia:** `test/cultura-hu.test.js` («el monitor no configura grupos y la delegacion ASIES guarda el reconocimiento»).
- **Resultado:** Aprobado.

### CP-030 — Pausa, apoyo, cédula e informes

- **Cuando** el personal registra una pausa creativa y un apoyo a un colegio. El estudiante guarda cédula `1061731427`, programa Derecho y caracterización Afro, se inscribe y el personal marca asistencia.
- **Entonces** la búsqueda por esa cédula devuelve Derecho, el registro calificado de Derecho confirma la asistencia, el informe de inclusión incluye Afro y el CSV del SNIES contiene el programa.
- **Evidencia:** `test/cultura-hu.test.js` («la pausa, el apoyo y la busqueda por cedula quedan registrados»).
- **Resultado:** Aprobado.

La subida de la foto o el PDF de la planilla (HU-08) y la segunda franja del mismo día (HU-05) están en el módulo y no tienen un caso automático en esta ejecución.

## 9. Carga, agenda y navegadores — 30 de octubre de 2026

Se corrió contra el sistema encendido en este equipo: API en `http://localhost:4000` y sitio en `http://localhost:5173`. El código es `main`. Las cuentas de la medición se crearon con el prefijo `rnf.20261030` y se borraron al terminar, junto con las citas y los horarios de prueba. No quedaron citas de esta medición.

### RNF-001 — 50 usuarios a la vez

Cincuenta sesiones de estudiante pidieron cada listado al mismo tiempo. Todas respondieron bien y la más lenta tardó menos de 2 segundos.

| Listado | Respuestas | Mediana | Peor caso |
|---|---|---|---|
| Eventos públicos | 50 de 50 | 150 ms | 249 ms |
| Servicios de orientación | 50 de 50 | 157 ms | 169 ms |
| Eventos del estudiante | 50 de 50 | 147 ms | 155 ms |
| Horarios libres | 50 de 50 | 122 ms | 136 ms |
| Mis citas | 50 de 50 | 142 ms | 153 ms |
| Grupos de Cultura | 50 de 50 | 189 ms | 199 ms |
| Agenda de Cultura | 50 de 50 | 142 ms | 159 ms |
| Oferta de Deporte | 50 de 50 | 178 ms | 187 ms |

**Resultado:** aprobado en este equipo. No mide un servidor publicado ni cincuenta personas en la red de la universidad.

### RNF-003 — Agendar en menos de 3 minutos

Diez cuentas de prueba recorrieron el mismo camino que la pantalla: ver servicios, ver horarios libres, agendar y consultar «Mis citas». Las diez citas quedaron creadas (respuesta 201). La más lenta tardó 78 ms y la más rápida 28 ms. El criterio del F-02 es 9 de 10; aquí fueron 10 de 10.

Además se recorrió la pantalla «Pedir una cita» con una cuenta de prueba: elegir orientación psicológica, el 16 de diciembre, las 11:00 a. m. y confirmar. La aplicación abrió «Mis citas» con el aviso de cita agendada. Ese recorrido cabe en los 3 minutos.

**Resultado:** aprobado como prueba de laboratorio. No sustituye una sesión en la que diez personas de Bienestar usen el sistema por su cuenta.

### RNF-005 — Chrome, Edge, Firefox y celular

Se abrió el portal en computador (1366×768) y el ingreso en una ventana de celular (390×844).

| Navegador | Escritorio | Ventana de celular |
|---|---|---|
| Google Chrome, instalado en el equipo | El portal muestra el título, los trámites y el botón Ingresar | El ingreso muestra Continuar con Google y las dimensiones |
| Microsoft Edge, instalado en el equipo | Igual que en Chrome | Igual que en Chrome |
| Firefox 157 | Igual que en Chrome. El texto del ingreso se acomoda y el botón de Google queda completo | Igual, con las cinco dimensiones visibles |

**Resultado:** aprobado en estos tres motores. No se probó un teléfono físico ni la red de la universidad.
