# Acumulado de documentación — Conecta BU

Compilado de lo que el proyecto ya tiene escrito, leído contra el Acta de constitución (F-00), la propuesta técnica (F-01) y la especificación de requisitos (F-02). Esos tres formatos no están en el repositorio: los citan la bitácora de desarrollo y la de pruebas. Este archivo no los reemplaza.

Fecha de este compilado: 10 de noviembre de 2026. Código: `main`, commit `dbe4f07`.

## 1. Identificación que repiten los documentos

| Campo | Dato |
|---|---|
| Nombre en el F-00 | Conecta DH |
| Producto construido | Conecta BU, el mismo encargo ampliado a Bienestar Institucional |
| Cliente | Ancizar Paz, coordinador del Área de Psicología |
| Equipo | Carlos Santiago Torres Castrillón (líder técnico) y Luisa Jhulieth Joaqui (líder de calidad) |
| Programa | Ingeniería de Software, 2026-2 |
| Inicio (F-00) | 26 de agosto de 2026 |
| Entrega estimada (F-00) | 20 de noviembre de 2026 |
| Repositorio | https://github.com/LuisaJoaquiJ/BU_Psicologia |

## 2. Dónde está cada pieza

| Pedido | Documento | Qué contiene |
|---|---|---|
| Requisitos del encargo original | F-02, citado en `docs/BITACORA-DE-DESARROLLO.md` sección 2 | RF-001 a RF-010 y RNF-001 a RNF-006 |
| Historias que el producto cumple | `docs/HISTORIAS-DE-USUARIO.md` | HU-001 a HU-021 |
| Historias de la ficha de Cultura | La misma HU-021, más el mapa HU-01 a HU-13 de esa ficha | Grupos, redes, talleres, pausas, fechas, apoyo, asistencia, evidencias, SNIES, registro calificado, caracterización, roles e histórico |
| Avance por sprint | `README.md`, tabla inicial, y bitácora de desarrollo sección 4 | Sprints 1 a 5 y la ampliación del portal |
| Actas y seguimiento | Bitácora de desarrollo, entradas 1 a 7 | Fechas, commits y diferencia frente al acta |
| Pruebas | `docs/BITACORA-DE-PRUEBAS.md` y `docs/entregables/PLAN-Y-EJECUCION-DE-PRUEBAS.md` | CP-001 a CP-030 y la carga del 30 de octubre |
| Uso | `docs/MANUAL-DE-USUARIO.md` y `docs/entregables/MANUAL-DE-USUARIO.md` | Pasos por rol |
| Arquitectura | `docs/entregables/MANUAL-TECNICO-Y-ARQUITECTURA.md` | Monolito modular, stack y diagramas |

La bitácora del 13 de octubre decía que los manuales no estaban. Desde entonces existen el manual de usuario y, con este compilado, el técnico y el de pruebas.

## 3. Requisitos del F-02 y dónde quedaron

| F-02 | Qué pide | Dónde se cumple | Historia |
|---|---|---|---|
| RF-001 | Registro | Primer ingreso con Google, no con contraseña | HU-001 |
| RF-002 | Inicio de sesión y menú según el rol | Auth y rutas protegidas | HU-002 |
| RF-003 | Horarios disponibles | Agendar cita | HU-003 |
| RF-004 | Agendar | Un cupo, una sola vez | HU-004 |
| RF-005 | Ver y cancelar | Mis citas; cancelar exige 24 horas, plazo que el F-02 no pedía | HU-005 |
| RF-006 | Asistencia a la cita | Agenda del personal | HU-009 |
| RF-007 | Gestión de eventos | Borrador o publicado | HU-006 |
| RF-008 | Inscripción | Sin duplicar y sin pasar el cupo | HU-007 |
| RF-009 | Asistencia al evento | Solo inscritos | HU-010 |
| RF-010 | Usuarios y horarios | Horarios del personal y usuarios del superadministrador | HU-008 |

El numeral 10 del F-02, el control de cambios, todavía no anota el ingreso con Google ni los módulos de Salud, Deporte, salidas y Cultura. La bitácora lo dejó pendiente.

## 4. Cortes, según las entradas de la bitácora

No hay en el repositorio un acta firmada por corte. Lo que sí está fechado es esto:

| Corte | Fecha | Qué se entregó | Frente al acta |
|---|---|---|---|
| 1 | 21 de septiembre de 2026 | Sesión institucional, roles y rutas. Commits `4399547`, `5b8af72` | Cubre el registro y el ingreso, con Google en lugar de contraseña |
| 2 | 9 de octubre de 2026 | Citas: servicios, cupo y cancelación. `5ea7758`, `a4afaa6` | RF-003 a RF-005 |
| 3 | 9 de octubre de 2026 | Horarios del personal y asistencia a la cita. `b0443ee` | RF-006 y parte de RF-010 |
| 4 | 9 de octubre de 2026 | Eventos, inscripción y asistencia. `76d42ec` | RF-007 a RF-009 |
| 5 | 9 de octubre de 2026 | Usuarios, avisos por n8n, asistente y tablero | Usuarios sí estaban en RF-010. El asistente y el tablero no estaban en el F-02 |
| Ampliación | 9 de octubre de 2026 | Portal de cinco dimensiones, Salud, salidas y Deporte | Fuera del numeral 7.1. Permanencia y Cultura figuraban como «Próximamente» |
| Ajustes | 9 de octubre de 2026 | Identidad visual, citas en tres pasos, fotos, atención sin cita | Hasta el commit `0b5930b`, que es el build de la bitácora de pruebas |
| Cultura | 30 y 31 de octubre de 2026 | Ficha del área, agenda de octubre y noviembre, historias HU-01 a HU-13, paleta y asistente | Fuera del F-02. Ocho casos de API aprobados |
| Laboratorio | 30 de octubre de 2026 | Carga de 50 sesiones, 10 agendamientos y revisión en Chrome, Edge y Firefox | Laboratorio local, no usuarios de la universidad |
| Integración posterior | Hasta el 10 de noviembre de 2026 | Equipo y roles de Cultura, ubicación, informe de gestión, notificaciones, fotos de salidas de Salud, portal | Commit `dbe4f07`. Entra en el manual de usuario de esta carpeta |

## 5. Lo que el acta excluye y se mantuvo

- No hay videollamada.
- No hay diagnóstico automático ni prescripción. El asistente se niega y muestra las líneas 123 y 192.
- No hay historia clínica.
- No hay aplicación de celular. El F-00 y el F-01 pedían sitio web.

## 6. Pendiente que los documentos siguen marcando

- Anotar en el numeral 10 del F-02 el ingreso con Google y los módulos que el acta no pedía.
- Publicar el sitio (compromiso 10.1 del F-00). Sigue en local, sin respaldo diario.
- Medir la cobertura del backend (RNF-004).
- Hacer la aceptación con personas de Bienestar cuando exista un ambiente publicado.
- Construir Permanencia estudiantil.
- Enlazar GitHub Projects, citado en el F-01 y no referenciado en estos archivos.
