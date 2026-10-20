# Manual de usuario — Conecta BU

Conecta BU es el sitio web de Bienestar Institucional de la Corporación Universitaria Autónoma del Cauca. Desde el navegador se piden citas, se consultan talleres, se registran horas de deporte y se reportan salidas institucionales.

Este manual es para quien usa el sistema: estudiantes, personal de Bienestar y el superadministrador. No explica cómo instalar el programa.

Mientras el sitio esté en el computador de desarrollo, se abre en `http://localhost:5173`. Cuando se publique, los mismos pasos valen en la dirección que indique la universidad.

## 1. Entrar y salir

1. Abra el sitio en Chrome, Edge o Firefox.
2. Pulse **Ingresar** y luego **Continuar con Google**.
3. Use su correo `@uniautonoma.edu.co`.

La primera vez el sistema crea la cuenta y entra como estudiante. Un correo de otro dominio no puede entrar. No hay contraseña de Conecta BU: la clave es la de Google.

Para salir, pulse **Cerrar sesión**. Después de una hora sin usar el sitio, hay que entrar de nuevo.

Si no puede ingresar, escriba a psicologiabienestar@uniautonoma.edu.co.

## 2. La página de inicio

Al entrar se ve el portal de las cinco dimensiones de Bienestar:

| Dimensión | Estado | Qué puede hacer |
|---|---|---|
| Desarrollo Humano | Disponible | Citas de orientación, talleres y asistente |
| Deporte y Recreación | Disponible | Grupos, asistencia y horas |
| Salud Integral | Disponible | Citas de salud, participaciones y salidas |
| Permanencia Estudiantil | Próximamente | Todavía no está habilitada |
| Arte y Cultura | Próximamente | Todavía no está habilitada |

Elija la dimensión. Si su correo fue asignado al personal de un módulo, el portal lo lleva al panel de ese módulo. El superadministrador ve, además, el acceso a su panel.

## 3. Estudiante — Desarrollo Humano

El menú tiene: **Inicio**, **Pedir una cita**, **Mis citas**, **Talleres y eventos**, **Servicios** y **Asistente**.

### Pedir una cita

1. Entre a **Pedir una cita**.
2. Elija el servicio (por ejemplo, orientación individual).
3. Elija un día y un horario libre.
4. Confirme.

El horario queda ocupado. Si otra persona lo tomó al mismo tiempo, el sistema pide elegir otro. Puede tener una cita de orientación activa y, aparte, una cita de salud.

### Mis citas

En **Mis citas** ve las citas agendadas. Para cancelar, la cita debe faltar más de 24 horas. Si falta menos, el sistema no la cancela y el horario sigue ocupado. Al cancelar a tiempo, el horario vuelve a quedar libre.

### Talleres y eventos

En **Talleres y eventos** aparecen los publicados, con fecha, lugar y cupos. Pulse inscribirse. No puede inscribirse dos veces al mismo taller ni cuando ya no hay cupo o pasó la fecha límite. Desde la misma pantalla puede cancelar su inscripción si el evento lo permite.

### Servicios

**Servicios** muestra qué ofrece el área y para qué sirve cada uno.

### Asistente

El **Asistente** responde dudas sobre cómo usar Bienestar: cómo pedir una cita, qué talleres hay y en qué horario. También se abre con el botón flotante, en cualquier pantalla menos en el ingreso. Si hay clave de Gemini, la respuesta sale de ese modelo; si no responde, sale de la base local. No hace diagnóstico, no recomienda medicamentos ni reemplaza una cita. La historia es la HU-012.

Si el mensaje habla de una emergencia, el asistente indica llamar a la línea 123 y a la 192 opción 4, y acercarse a Bienestar. Ese tipo de mensaje no se envía a un modelo de inteligencia artificial.

## 4. Estudiante — Salud Integral

Entre por la tarjeta **Salud Integral**. El menú tiene **Agendar cita**, **Mis citas**, **Mis participaciones** y **Salidas**.

- **Agendar cita** reserva una cita de enfermería o medicina, distinta de la de orientación.
- **Mis citas** muestra solo las citas de salud.
- **Mis participaciones** lista las actividades de salud en las que quedó registrado.
- **Salidas** muestra las salidas institucionales en las que está inscrito.

## 5. Estudiante — Deporte

Entre por **Deporte y Recreación**. El menú tiene **Mi avance**, **Disciplinas e inscripción** y **Mis horas**.

- **Mi avance** muestra cuántas horas lleva de las 40 que exige la universidad y las clases de la semana.
- **Disciplinas e inscripción** lista los grupos del periodo, con horario, lugar, instructor y cupo. Puede inscribirse o retirarse. No deja inscribirse si el horario se cruza con otro grupo, si no hay cupo o si ya llegó al máximo de grupos del periodo (2).
- **Mis horas** es el historial. Desde ahí puede descargar la constancia en PDF.

Las horas se acumulan en toda la carrera. No se reinician cada periodo.

## 6. Salidas institucionales

Cualquier persona de la universidad, con su cuenta, puede reportar una salida. Desde el portal, en Salud, use **Reportar salida institucional**, o entre a **Nuevo reporte**.

Indique el tipo de salida. El sistema pide los documentos según el caso:

| Tipo | Anticipación | Documento |
|---|---|---|
| Salida con estudiantes, local, regional o nacional | — | Póliza estudiantil |
| Salida con estudiantes, internacional | 5 días | Certificado de movilidad internacional |
| Representación institucional, local, regional o nacional | 3 días | — |
| Representación institucional, internacional | 5 días | Certificado de movilidad internacional |
| Traslado de docentes de posgrados | 3 días | — |
| Condición insegura, acto inseguro o incidente | — | Fotos, si las tiene |

Según el transporte, pide licencia y documentos del vehículo, datos del vuelo, empresa de transporte público, o conductor y placa. Los demás viajeros se escriben con su cédula. Al escribir un nombre aparecen sugerencias de personas ya registradas.

En **Mis reportes** ve el estado: Recibido, Verificado, Requiere ajustes o Cerrado. Puede completar documentos mientras el reporte no esté verificado. Si lo envió con menos anticipación de la exigida, queda marcado como fuera de tiempo.

## 7. Personal de Desarrollo Humano

Entra quien tenga el correo asignado a este módulo, y el superadministrador. El menú tiene **Inicio**, **Citas**, **Horarios**, **Talleres y eventos** y **Estadísticas**.

### Horarios

En **Horarios** publica los bloques en los que atiende. Puede agregar una semana o una sola hora, y deshabilitar un horario para que el estudiante deje de verlo. **No estaré disponible** bloquea un tiempo (compromiso, incapacidad, permiso o salida) para que no se agenden citas ahí.

### Citas

En **Citas** ve la agenda: pendientes de asistencia, las de hoy y las próximas. Puede filtrar por fecha, estado, servicio y estudiante. Cuando la cita ya pasó, márquela como **Asistió** o **No asistió**.

Si la persona llega sin haber agendado, regístrela desde la atención sin cita: búsquela por nombre o correo, o créela con su correo institucional, indique el servicio, la hora y una nota. Queda como cita a la que sí asistió.

### Talleres y eventos

En **Talleres y eventos** cree el evento. Puede quedar en borrador o publicarse de una vez. Un evento publicado lo ven los estudiantes. Puede ser presencial o virtual; si es virtual, lleve el enlace de la reunión. Puede subir una foto (JPG, PNG o WEBP, hasta 5 MB).

Si el evento ya tiene inscritos y lo va a eliminar, el sistema pide confirmación. En **Inscritos y asistencia** marque quién asistió. Solo se marca a quien está inscrito.

### Estadísticas

**Estadísticas** resume citas (atendidas, no asistieron, canceladas), asistencia a eventos y citas por servicio. Puede filtrar por fechas y descargar el informe en Excel o PDF. Si el filtro no tiene datos, el panel lo dice.

## 8. Personal de Salud Integral

Entra quien tenga el correo asignado a Salud. El menú tiene **Inicio**, **Registrar**, **Actividades**, **Personas**, **Salidas**, **Reportes SST**, **Horarios de citas**, **Agenda de citas**, **Informe de gestión** y **Reportes**.

- **Registrar:** con la cédula o el código estudiantil (también con lector de código de barras) la persona queda registrada. La primera vez se pide la autorización de datos. En la atención de enfermería se anotan signos vitales, insumos, descripción y remisión. Hay un modo lista para jornadas.
- **Actividades:** catálogo del periodo, con código, meta, jornadas, asistentes y evidencias (fotos y PDF).
- **Personas:** historial de cada persona.
- **Horarios de citas** y **Agenda de citas:** igual que en orientación, pero solo para citas de salud.
- **Salidas:** inscripción de estudiantes a una salida, revisión de comprobantes y listado para la ARL.
- **Reportes SST:** bandeja de los reportes recibidos. Pase de Recibido a Verificado, Requiere ajustes o Cerrado. No se puede verificar una salida si faltan documentos. Puede marcar que ya se reportó a la ARL o que se gestionó ASIST CARD, dejar una observación y exportar a Excel.
- **Informe de gestión:** arma el informe del periodo en cinco pasos (proyecto, evaluación, avances, cifras y revisión). Se descarga en PDF o Excel. Al enviarlo queda bloqueado y lo recibe el superadministrador. Si lo devuelven, se corrige y se envía de nuevo.
- **Reportes:** plantilla SNIES, registro de atenciones e importación de los Excel que ya tenía la unidad. La importación muestra una vista previa y no duplica registros.

## 9. Personal de Deporte

Entra quien tenga el correo asignado a Deporte. El menú tiene **Inicio**, **Grupos y asistencia**, **Estudiantes y horas** y **Disciplinas**.

- **Grupos y asistencia:** cree o edite el grupo (horario, lugar, instructor y cupo), abra o cierre inscripciones e inscriba por correo. En cada sesión tome la asistencia: quien esté presente suma las horas de esa sesión. Puede corregir o borrar una asistencia.
- **Estudiantes y horas:** avance de cada estudiante, horas reconocidas por torneos o eventos, constancia y reporte en Excel.
- **Disciplinas:** el catálogo (natación, running, voleibol, fútbol y las demás) y el requisito de horas, 40 por defecto.

## 10. Superadministrador

Ve todos los módulos. Su menú tiene **Inicio**, **Estadísticas**, **Informes**, **Accesos** y **Usuarios**.

- **Accesos:** escriba el correo institucional de quien va a operar un módulo (Desarrollo Humano, Salud o Deporte). Puede asignar a alguien que todavía no ha entrado. Si le quita todos los accesos, esa persona vuelve a ser estudiante.
- **Usuarios:** busque por nombre o correo, cambie el rol y habilite o deshabilite. Nadie puede cambiarse su propio rol ni deshabilitarse. Siempre debe quedar al menos un administrador habilitado. Una persona deshabilitada pierde el acceso de inmediato.
- **Informes:** recibe los informes de gestión de Salud. Los descarga en PDF o Excel, los aprueba o los devuelve con observaciones.
- **Estadísticas:** tablero de todos los módulos.

## 11. Lo que el sistema no hace

- No atiende por videollamada.
- No diagnostica ni formula medicamentos. El asistente se niega a esas preguntas y orienta a pedir una cita.
- No consulta la historia clínica de la universidad.
- No tiene aplicación de tienda para Android ni para iOS. Se usa en el navegador del computador o del celular.

## 12. Documentos de este mismo proyecto

| Documento | Dónde está |
|---|---|
| Bitácora de desarrollo | `docs/BITACORA-DE-DESARROLLO.md` |
| Bitácora de pruebas | `docs/BITACORA-DE-PRUEBAS.md` |
| Historias de usuario que se cumplen | `docs/HISTORIAS-DE-USUARIO.md` |
| Pruebas automáticas de la API | `backend/test/` |
