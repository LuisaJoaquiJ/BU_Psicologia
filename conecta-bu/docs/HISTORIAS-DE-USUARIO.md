# Historias de usuario que se cumplen — Conecta BU

Texto de las historias cuyo comportamiento ya está en el producto. Cada una dice qué puede hacer una persona hoy en http://localhost:5173. Lo que el sistema no hace (videollamada, diagnóstico, Permanencia, Arte y Cultura, aplicación de tienda) no tiene historia aquí.

La bitácora de pruebas usa estos mismos identificadores HU-001 a HU-008. El README del sprint 1 llama HU-01 a HU-05 a partes del ingreso: aquí esas partes están en HU-001 y HU-002.

| En el README del sprint 1 | En este documento |
|---|---|
| HU-01 y HU-02 | HU-001 |
| HU-03, HU-04 y HU-05 | HU-002 |

## HU-001 — Entrar con la cuenta institucional

**Se cumple.** F-02 RF-001. En el código el primer ingreso es parte del login con Google. Caso CP-001.

Como estudiante de la Uniautónoma, quiero entrar con mi correo institucional, para que el sistema cree mi cuenta sin pedirme otra contraseña.

- Acepta un correo `@uniautonoma.edu.co` y, si es la primera vez, crea la cuenta como estudiante.
- Rechaza un correo de otro dominio.
- No hay formulario de registro ni contraseña de Conecta BU.

## HU-002 — Mantener la sesión y ver solo mi menú

**Se cumple.** F-02 RF-002. Casos CP-002, CP-003 y CP-013.

Como persona autenticada, quiero cerrar sesión y que cada rol vea solo sus pantallas, para que un estudiante no entre al panel del personal.

- **Cerrar sesión** vuelve al ingreso.
- El estudiante ve el menú de estudiante. El personal ve el panel del módulo que tiene asignado.
- Sin token la API responde 401. Con token de estudiante, una ruta de administración responde 403.

## HU-003 — Ver horarios libres

**Se cumple.** F-02 RF-003. Caso CP-004.

Como estudiante, quiero ver los horarios libres de orientación, para elegir uno que todavía se pueda tomar.

- Solo aparecen horarios habilitados, libres y de hoy en adelante.
- Un horario ocupado o deshabilitado no se ofrece.

## HU-004 — Agendar una cita de orientación

**Se cumple.** F-02 RF-004. Caso CP-005.

Como estudiante, quiero confirmar una cita en un horario libre, para reservar la atención sin que otra persona se quede con el mismo cupo.

- Al confirmar, el horario queda ocupado.
- Si dos personas confirman el mismo horario, solo una cita queda guardada.
- En orientación solo puede haber una cita activa. Una cita de salud no cuenta para ese límite.

## HU-005 — Ver y cancelar mis citas

**Se cumple.** F-02 RF-005. Caso CP-006. El plazo de 24 horas no estaba en el F-02.

Como estudiante, quiero ver mis citas y cancelar la que ya no voy a usar, para liberar el horario con tiempo.

- **Mis citas** muestra las citas de esa persona.
- La cancelación se permite si faltan más de 24 horas. Si falta menos, la cita sigue y el horario sigue ocupado.
- Al cancelar a tiempo, el horario vuelve a quedar libre.

## HU-006 — Publicar talleres y eventos

**Se cumple.** F-02 RF-007. Caso CP-008.

Como personal de Desarrollo Humano, quiero crear, editar y retirar talleres, para que el estudiante vea solo los que ya están publicados.

- Un evento puede quedar en borrador o publicarse.
- Puede ser presencial o virtual. Si es virtual, lleva el enlace de la reunión.
- Se puede subir una foto JPG, PNG o WEBP de hasta 5 MB.
- Si ya hay inscritos y se va a eliminar, el sistema pide confirmación.

## HU-007 — Inscribirme a un taller

**Se cumple.** F-02 RF-008. Caso CP-009.

Como estudiante, quiero inscribirme a un taller publicado, para apartar mi cupo y poder retirarme si el evento lo permite.

- No deja inscribirse dos veces, ni sin cupo, ni después de la fecha límite.
- Si dos personas toman el último cupo, solo una inscripción queda guardada.
- La persona puede cancelar su inscripción cuando el evento lo permite.

## HU-008 — Administrar usuarios y horarios de atención

**Se cumple.** F-02 RF-010. Casos CP-011 y CP-012. Deshabilitar a alguien no pregunta si tiene citas activas; el F-02 sí lo pedía.

Como personal, quiero publicar mis horarios de atención. Como superadministrador, quiero buscar usuarios y cambiar su rol o su acceso, para que cada quien entre solo a lo que le corresponde.

- El personal crea, edita y deshabilita horarios. **No estaré disponible** bloquea un tiempo para que no se agenden citas ahí.
- El superadministrador busca por nombre o correo, cambia el rol y habilita o deshabilita.
- Nadie puede cambiarse el propio rol ni deshabilitarse. Siempre queda al menos un administrador habilitado.
- Una persona deshabilitada pierde el acceso en la siguiente petición.

## HU-009 — Registrar la asistencia a la cita

**Se cumple.** F-02 RF-006. Caso CP-007. La bitácora de pruebas la había dejado dentro de HU-004; el comportamiento es otro y aquí tiene su propia historia.

Como personal de orientación, quiero marcar si la persona asistió, para llevar la agenda del día.

- En **Citas** se filtra por fecha, estado, servicio y estudiante.
- Cuando la cita ya pasó, se marca **Asistió** o **No asistió**.

## HU-010 — Registrar la asistencia al taller

**Se cumple.** F-02 RF-009. Caso CP-010. La bitácora de pruebas la había dejado dentro de HU-006.

Como personal, quiero marcar la asistencia de quienes se inscribieron, para saber quién vino.

- Solo se marca a quien está inscrito en ese evento.

## HU-011 — Avisar sin frenar la cita

**Se cumple en el código, con el aviso en espera.** El README lo llama RF-013. Caso CP-015. n8n no está corriendo en este equipo, así que el correo del aviso no sale.

Como estudiante, quiero que mi cita o mi inscripción queden guardadas aunque el aviso automático falle, para no perder el cupo por un fallo del notificador.

- Al agendar, cancelar, publicar un evento o inscribirse, el backend intenta avisar a n8n.
- Si n8n no responde, la cita o la inscripción igual queda guardada.
- El aviso no lleva datos clínicos.

## HU-012 — Preguntarle a la IA cómo usar Bienestar

**Se cumple.** En el código y en el F-03 es RF-014, con la regla RN-011. Caso CP-014. El F-02 no le dio número. El 13 de octubre de 2026 se probó con Gemini: una pregunta de citas respondió el modelo y una pregunta de medicamento se bloqueó antes de salir del servidor.

Como estudiante con la sesión iniciada, quiero preguntarle al asistente cómo pedir una cita, qué servicios hay y qué talleres vienen, para orientarme sin que el asistente haga de psicólogo.

- Puedo abrirlo en **Asistente** o en el botón flotante, que aparece en cualquier pantalla menos en el ingreso.
- Responde en español sobre el uso de Conecta BU y sobre los servicios, horarios y eventos publicados.
- Si hay clave de Gemini, la respuesta sale del modelo. Si el modelo no responde, la respuesta sale de la base local del sistema. La cita o la pantalla no se quedan esperando.
- Al modelo solo se envían el primer nombre y datos públicos: servicios, cuántos horarios hay libres y los próximos eventos. El correo no se envía.
- Si escribo sobre diagnóstico, medicamento o tratamiento, la respuesta es fija: no puede formular y me invita a agendar una cita. Esa pregunta no se envía al modelo.
- Si el mensaje habla de hacerme daño, la respuesta indica la línea 123 y la 192 opción 4, y acercarme a Bienestar. Ese mensaje tampoco se envía al modelo.
- La pregunta no puede pasar de 500 caracteres. El historial del chat no se guarda en la base de datos.
- El asistente no reemplaza una cita, no hace videollamada y no consulta la historia clínica.

## HU-013 — Ver el tablero de orientación

**Se cumple.** En el código y en el F-03 es RF-015. Caso CP-016.

Como personal de Desarrollo Humano, quiero ver citas, asistencia a talleres y citas por servicio, para revisar el periodo y descargar el informe.

- Se puede filtrar por fechas.
- Si el filtro no tiene datos, el panel lo dice.
- El informe se descarga en Excel o en PDF.

## HU-014 — Entrar por el portal de Bienestar

**Se cumple.** No está en el F-02. Lo usa quien ya inició sesión.

Como persona de la universidad, quiero ver las cinco dimensiones de Bienestar al entrar, para ir a la que necesito.

- Desarrollo Humano, Salud Integral y Deporte y Recreación abren su módulo.
- Permanencia Estudiantil y Arte y Cultura se ven como **Próximamente** y no tienen funciones.

## HU-015 — Registrar la atención de salud

**Se cumple.** Fuera del F-02. Caso CP-017. Entra solo el personal cuyo correo fue asignado a Salud, y el superadministrador.

Como personal de Salud, quiero registrar a la persona por cédula o código y anotar la atención, para reemplazar el Excel de la unidad.

- La primera vez se pide la autorización de datos.
- Se anotan signos vitales, insumos, descripción y remisión.
- Hay actividades del periodo, con meta, asistentes y evidencias.
- Las citas de salud se agendan aparte de las de orientación.

## HU-016 — Enviar el informe de gestión de salud

**Se cumple.** Fuera del F-02. Caso CP-018.

Como personal de Salud, quiero armar el informe del periodo y enviarlo. Como superadministrador, quiero aprobarlo o devolverlo, para cerrar el informe con observación.

- El informe se arma por pasos y se descarga en PDF o Excel.
- Al enviarlo queda bloqueado.
- Si el superadministrador lo devuelve, se corrige y se envía de nuevo.

## HU-017 — Reportar una salida institucional

**Se cumple.** Fuera del F-02. Caso CP-019.

Como persona de la universidad, quiero radicar una salida con los documentos que pide su tipo, para que Salud la revise.

- Los documentos y la anticipación cambian según el tipo de salida y el transporte.
- En **Mis reportes** se ve Recibido, Verificado, Requiere ajustes o Cerrado.
- No se puede verificar una salida si faltan documentos.

## HU-018 — Llevar las horas de deporte

**Se cumple.** Fuera del F-02. Caso CP-020.

Como estudiante, quiero inscribirme a un grupo y ver cuántas horas llevo de las 40, para descargar la constancia cuando cumpla.

- No deja inscribirse si el horario se cruza, si no hay cupo o si ya tiene 2 grupos en el periodo.
- La asistencia de una sesión suma las horas de esa sesión.
- Las horas se acumulan en la carrera. La constancia sale en PDF.

## HU-019 — Asignar quién opera cada módulo

**Se cumple.** Fuera del F-02. Caso CP-021.

Como superadministrador, quiero escribir el correo de quien va a operar Desarrollo Humano, Salud o Deporte, para que esa persona vea el panel aunque todavía no haya entrado.

- Si se le quitan todos los accesos, vuelve a entrar como estudiante.
- El superadministrador ve el tablero de todos los módulos.

## HU-020 — Atender a quien llega sin cita

**Se cumple.** Fuera del F-02. Caso CP-022.

Como personal de orientación, quiero registrar a quien llega sin haber agendado, para que esa atención quede como cita a la que sí asistió.

- Se busca por nombre o correo, o se crea con el correo institucional.
- Se indican el servicio, la hora y una nota.
- Queda en estado **Asistió** y cuenta en las estadísticas.
