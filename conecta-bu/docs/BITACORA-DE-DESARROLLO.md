# Bitácora de desarrollo — Conecta BU

Registro del trabajo construido, leído contra el Acta de constitución (F-00), la propuesta técnica (F-01) y la especificación de requisitos (F-02). Cuando el producto entregado no coincide con esos documentos, la entrada lo dice.

## 1. Identificación

| Campo | Dato |
|---|---|
| Proyecto en el F-00 | Conecta DH |
| Producto construido | Conecta BU (el mismo encargo, ampliado a Bienestar Institucional) |
| Dependencia | Bienestar — Área de Psicología |
| Cliente | Ancizar Paz, coordinador del Área de Psicología |
| Equipo | Carlos Santiago Torres Castrillón (líder técnico) y Luisa Jhulieth Joaqui (líder de calidad) |
| Programa / periodo | Ingeniería de Software, 2026-2 |
| Inicio (F-00) | 26 de agosto de 2026 |
| Entrega estimada (F-00) | 20 de noviembre de 2026 |
| Repositorio | https://github.com/LuisaJoaquiJ/BU_Psicologia |
| Esta bitácora | 13 de octubre de 2026 |

## 2. Cómo se leen los identificadores

El F-02 numera los requisitos de una forma y el repositorio, de otra. Esta bitácora usa siempre el identificador del F-02. La columna «en el código» indica el nombre con el que aparece en el README y en las pruebas.

| F-02 | Nombre en el F-02 | En el código |
|---|---|---|
| RF-001 | Registro de usuario estudiante | Primer ingreso con Google (el README lo llama parte de RF-001) |
| RF-002 | Inicio de sesión | `auth.test.js` (el README lo llama RF-001 y RF-002) |
| RF-003 | Consulta de horarios disponibles | `citas.test.js`, descrito allí como RF-004 |
| RF-004 | Agendamiento de cita | `citas.test.js`, descrito allí como RF-005 |
| RF-005 | Consulta y cancelación de citas | `citas.test.js`, descrito allí como RF-006 |
| RF-006 | Confirmación de asistencia a citas | `horarios.test.js`, descrito allí como RF-008 |
| RF-007 | Gestión de eventos | `eventos.test.js`, descrito allí como RF-009 |
| RF-008 | Consulta e inscripción a eventos | `eventos.test.js`, descrito allí como RF-010 |
| RF-009 | Control de asistencia a eventos | `eventos.test.js`, descrito allí como RF-011 |
| RF-010 | Administración de usuarios y horarios | Horarios en el sprint 3; usuarios en el sprint 5 (README RF-012) |

## 3. Stack que registran el F-00 y el F-01

Los tres formatos quedaron alineados con el producto: aplicación web, no aplicación de celular.

| Capa | Según F-00 y F-01 | En el repositorio |
|---|---|---|
| Cliente | React, en el navegador | React 18 y Vite 5 |
| API | Node.js y Express | Express 4 |
| Datos | PostgreSQL | PostgreSQL local (en este equipo, versión 18) y Prisma 5 |
| Identidad | Cuenta institucional de Google y JWT propio | Igual |
| App nativa | No entra en esta etapa | No se desarrolló |

Sigue habiendo una diferencia de identidad frente al texto original del F-02: allí el registro era con correo y contraseña. En el sistema la cuenta se crea al entrar con Google. El control de cambios del F-02 (numeral 10) no tiene esa fila. Lo que el acta excluye se mantuvo: no hay videollamada, no hay diagnóstico automático, no hay prescripción de medicamentos y no hay historia clínica.

## 4. Entradas

### Entrada 1 — Base y sesión institucional

- **Fecha:** 21 de septiembre de 2026
- **Commits:** `4399547`, `5b8af72`
- **Requisitos del F-02:** RF-001 y RF-002 (sprint 1 del F-02)
- **Qué se hizo.** Repositorio con frontend y backend. El estudiante no llena un formulario de registro: la primera vez que entra con Google, si el correo es `@uniautonoma.edu.co`, el sistema crea la cuenta. Una cuenta de otro dominio se rechaza. Cada rol ve sus rutas y el backend responde 401 o 403 si falta el permiso.
- **Frente al acta.** Cubre el registro y el inicio de sesión del numeral 7.1, con otro mecanismo de identidad. No hay contraseña ni bcrypt (RNF-002 del F-02 queda sin objeto para las contraseñas).

### Entrada 2 — Citas de orientación

- **Fecha:** 9 de octubre de 2026
- **Commits:** `5ea7758`, `a4afaa6`
- **Requisitos del F-02:** RF-003, RF-004 y RF-005 (sprint 2)
- **Qué se hizo.** Catálogo de servicios, horarios disponibles, agendamiento y pantalla «Mis citas». Si dos personas toman el mismo cupo, solo queda una cita. La cancelación libera el horario y solo se permite con al menos 24 horas de anticipación. El F-02 no pedía ese plazo.
- **Reglas.** RN-001 del F-02 (una cita activa) se cumple dentro del módulo de orientación. Más adelante el estudiante puede tener, además, una cita de salud.

### Entrada 3 — Horarios del personal y asistencia a la cita

- **Fecha:** 9 de octubre de 2026
- **Commit:** `b0443ee`
- **Requisitos del F-02:** RF-006 y la parte de horarios de RF-010 (el F-02 los ubicaba en los sprints 3 y 4)
- **Qué se hizo.** El personal crea, edita y deshabilita horarios, ve la agenda y marca «Asistió» o «No asistió».

### Entrada 4 — Eventos, inscripción y asistencia

- **Fecha:** 9 de octubre de 2026
- **Commit:** `76d42ec`
- **Requisitos del F-02:** RF-007, RF-008 y RF-009
- **Qué se hizo.** El personal crea eventos (quedan en borrador o publicados), los edita y, si hay inscritos, debe confirmar para eliminarlos. El estudiante ve los publicados, se inscribe hasta la fecha límite y no puede inscribirse dos veces. El cupo no se supera aunque dos personas tomen el último al mismo tiempo. El personal marca la asistencia solo de quienes están inscritos.
- **Reglas.** RN-002 y RN-003 del F-02.

### Entrada 5 — Usuarios, avisos, asistente y tablero

- **Fecha:** 9 de octubre de 2026
- **Commits:** `c0ec676`, `b443758`, `f66b9ab`, `ec011b2`
- **Requisitos del F-02:** el resto de RF-010 (usuarios). Lo demás no está en el F-02.
- **Qué se hizo.** Búsqueda de usuarios, cambio de rol y habilitar o deshabilitar, sin poder quitarse el propio acceso y dejando siempre al menos un administrador. Envío de avisos a n8n cuando se agenda, se cancela o hay un evento; si n8n no responde, la operación igual queda guardada. Asistente de orientación que no responde diagnósticos ni medicamentos y, ante un mensaje de crisis, muestra las líneas 123 y 192. Tablero de citas, eventos y servicios, con exportación a Excel y PDF.
- **Frente al acta.** El numeral 7.2 excluye el chat de atención psicológica y el diagnóstico automático. El asistente orienta sobre cómo usar Bienestar y se niega a lo clínico. No sustituye una cita.

### Entrada 6 — Portal y módulos que el acta no pedía

- **Fecha:** 9 de octubre de 2026
- **Commits principales:** `d5822a2`, `42ed41e`, `ae5b60d`, `427613f`, `cc7e09c`, `520b8da`
- **Qué se hizo.** El inicio agrupa cinco dimensiones de Bienestar. Desarrollo humano, Salud integral y Deporte están operativos. Permanencia estudiantil y Arte y cultura aparecen como «Próximamente».
  - **Salud integral:** registro por cédula o código, actividades con evidencias, citas propias del módulo, informe de gestión INFBI-002 (PDF y Excel) y revisión del superadministrador.
  - **Salidas institucionales:** reemplaza el formulario «0 SALUD INTEGRAL», con documentos según el tipo de salida y bandeja de revisión.
  - **Deporte:** grupos por periodo, inscripción, asistencia por sesión, 40 horas y constancia en PDF.
  - **Accesos:** el superadministrador asigna por correo quién entra al panel de cada módulo.
- **Frente al acta.** Esto está fuera del numeral 7.1. No estaba en el control de cambios del F-02.

### Entrada 7 — Ajustes de uso del personal

- **Fecha:** 9 de octubre de 2026
- **Commits:** de `f5249f9` a `0b5930b`
- **Qué se hizo.** Identidad visual de la Uniautónoma, citas en tres pasos, agenda, fotos de eventos, atención de quien llega sin cita, tiempo no disponible del profesional, eventos virtuales con enlace y corrección de ortografía. Los archivos subidos dejaron de versionarse.

## 5. Lo que el F-00 pedía y dónde quedó

| Alcance del numeral 7.1 | Dónde está |
|---|---|
| Registro e inicio de sesión | Entrada 1, con Google |
| Dos tipos de usuario | Estudiante y personal; se añadió el superadministrador |
| Horarios, agendar, ver y cancelar citas | Entradas 2 y 3 |
| Asistencia a citas | Entrada 3 |
| Crear, editar y eliminar eventos | Entrada 4 |
| Inscripción y asistencia a eventos | Entrada 4 |
| Administración de usuarios y horarios | Entradas 3 y 5 |
| Base de datos | PostgreSQL, 11 migraciones de Prisma |
| Repositorio Git | https://github.com/LuisaJoaquiJ/BU_Psicologia |
| Manuales | No están. El README técnico no es el manual de usuario del F-00 |

## 6. Pendiente frente a los documentos

- Anotar en el numeral 10 del F-02 el ingreso con Google (en vez del registro con contraseña) y los módulos de Salud, Deporte y salidas.
- Manual de usuario y producto desplegado (compromiso 10.1 del F-00). El sistema corre en local.
- GitHub Projects, citado en el F-01, no está enlazado en estos documentos.
- Permanencia estudiantil y Arte y cultura siguen sin construir.
