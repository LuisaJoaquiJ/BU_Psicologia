// Datos de prueba de Arte y Cultura, para ver el modulo funcionando completo.
//
//   node scripts/demo-cultura.js            carga los datos
//   node scripts/demo-cultura.js limpiar    borra solo lo que cargo este script
//
// Crea estudiantes y personal de prueba (correos demo.*@uniautonoma.edu.co),
// grupos y talleres del periodo con inscritos y asistencia, inscripciones a la
// agenda que ya existe, convocatorias, delegaciones a redes con su oficio,
// pausas creativas, solicitudes de apoyo, inventario con prestamos y
// pendientes. Lo que crea queda anotado en scripts/demo-cultura.ids.json; la
// limpieza borra solo eso, nunca la agenda real ni las cuentas existentes.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const { config } = require("../src/config/env");
const { periodoActual } = require("../src/modules/cultura/periodo");

const prisma = new PrismaClient();
const REGISTRO = path.join(__dirname, "demo-cultura.ids.json");
const CARPETA = path.join(config.saludUploadsDir, "cultura");
const MARCA = "demo@conectabu";

// Dias relativos a hoy en Bogota, como fecha (YYYY-MM-DD) y como Date de base de datos.
const hoyBogota = () => new Date(Date.now() - 5 * 3600 * 1000);
const dia = (n) => new Date(hoyBogota().getTime() + n * 86400000).toISOString().slice(0, 10);
const fecha = (n) => new Date(`${dia(n)}T00:00:00.000Z`);
const ip = () => `10.20.${1 + Math.floor(Math.random() * 30)}.${2 + Math.floor(Math.random() * 200)}`;

const ESTUDIANTES = [
  ["valentina.munoz", "Valentina Muñoz Rivera", 1, "Derecho", "No registra"],
  ["santiago.erazo", "Santiago Erazo Paz", 1, "Ingeniería de Sistemas", "Mestizo"],
  ["camila.chicangana", "Camila Chicangana López", 1, "Psicología", "Indígena"],
  ["juan.mosquera", "Juan David Mosquera", 1, "Administración de Empresas", "Afro"],
  ["laura.ordonez", "Laura Ordóñez Muñoz", 1, "Licenciatura en Educación Infantil", "No registra"],
  ["andres.guzman", "Andrés Felipe Guzmán", 1, "Derecho", "No registra"],
  ["maria.anacona", "María José Anacona", 1, "Contaduría Pública", "Indígena"],
  ["daniel.velasco", "Daniel Velasco Ruiz", 1, "Ingeniería Electrónica", "No registra"],
  ["sofia.ceron", "Sofía Cerón Bolaños", 1, "Psicología", "Mestizo"],
  ["kevin.angulo", "Kevin Angulo Riascos", 1, "Ingeniería de Sistemas", "Afro"],
  ["natalia.gomez", "Natalia Gómez (egresada)", 4, "Derecho", "No registra"],
  ["jorge.paz", "Jorge Paz (egresado)", 4, "Administración de Empresas", "No registra"],
  ["diana.realpe", "Diana Realpe (administrativa)", 3, "Talento Humano", "No registra"],
  ["carlos.solarte", "Carlos Solarte (docente)", 2, "Ingeniería de Sistemas", "No registra"],
];

const PERSONAL = [
  ["docente.guitarra", "Mauricio Hoyos (docente OPS)", "docente"],
  ["docente.danzas", "Paola Castillo (docente OPS)", "docente"],
  ["monitor.cultura", "Felipe Rengifo (monitor)", "monitor"],
];

// Grupos del periodo: [area, nombre, director, lugar, cupo, horario, codigo SNIES, inscritos (indices)]
// Nadie queda en mas de 2 grupos (el limite del periodo) ni con horarios cruzados.
const GRUPOS = [
  ["Guitarra", "Taller de guitarra", "Mauricio Hoyos", "Salón de música 2", 20, [{ dia: 1, inicio: "14:00", fin: "16:00" }, { dia: 3, inicio: "14:00", fin: "16:00" }], "CUL-TG-01", [0, 1, 3, 5, 7, 9, 13]],
  ["Piano", "Taller de piano", "Mauricio Hoyos", "Salón de música 1", 8, [{ dia: 2, inicio: "10:00", fin: "12:00" }], "CUL-TP-02", [0, 2, 4, 6, 8, 10, 11, 12]],
  ["Ritmos latinos", "Ritmos latinos", "Paola Castillo", "Coliseo", 25, [{ dia: 4, inicio: "17:00", fin: "19:00" }], "CUL-RL-03", [2, 12]],
  ["Expresión corporal y oralidad", "Expresión corporal y oralidad", "Paola Castillo", "Auditorio", 15, [{ dia: 5, inicio: "08:00", fin: "10:00" }], "CUL-EC-04", [5, 9, 11]],
  ["Uniautónoma Band", "Uniautónoma Band", "Mauricio Hoyos", "Salón de música 2", 12, [{ dia: 2, inicio: "16:00", fin: "18:00" }, { dia: 4, inicio: "16:00", fin: "18:00" }], "CUL-RB-05", [1, 3, 7, 13]],
  ["Synapsis", "Teatro Sinapsis", "Paola Castillo", "Auditorio", 15, [{ dia: 3, inicio: "17:00", fin: "19:00" }], "CUL-RT-06", [6, 8]],
  ["Grupo de danzas folclóricas", "Grupo de danzas folclóricas", "Paola Castillo", "Coliseo", 20, [{ dia: 1, inicio: "17:00", fin: "19:00" }, { dia: 5, inicio: "15:00", fin: "17:00" }], "CUL-RD-07", [4, 10]],
];

// PDF minimo y valido para el oficio de ejemplo.
function pdfOficio(texto) {
  const contenido = `BT /F1 14 Tf 72 720 Td (${texto}) Tj ET`;
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const posiciones = [];
  objetos.forEach((o, i) => {
    posiciones.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posiciones.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

async function cargar() {
  if (fs.existsSync(REGISTRO)) {
    console.log("Ya hay datos de prueba cargados. Bórralos primero con: node scripts/demo-cultura.js limpiar");
    return;
  }
  const ids = { usuarios: [], accesos: [], grupos: [], eventosInscripciones: [], conteosEventos: [], convocatorias: [], representaciones: [], evidencias: [], archivos: [], pausas: [], solicitudes: [], articulos: [], tareas: [] };
  const guardar = () => fs.writeFileSync(REGISTRO, JSON.stringify(ids, null, 2));
  guardar();

  const rol = async (n) => (await prisma.rol.findUnique({ where: { nombre: n } })).id;
  const rolEstudiante = await rol("Estudiante");
  const rolAdmin = await rol("Administrador");
  const periodo = periodoActual();

  // Personas
  const estudiantes = [];
  for (const [usuario, nombre, tipo, programa, caracterizacion] of ESTUDIANTES) {
    const email = `demo.${usuario}@uniautonoma.edu.co`;
    const u = await prisma.usuario.create({ data: { emailInstitucional: email, nombre, rolId: rolEstudiante } });
    ids.usuarios.push(u.id);
    await prisma.perfilCultural.create({ data: { usuarioId: u.id, tipoSnies: tipo, programa, caracterizacion, documento: String(1061700000 + estudiantes.length * 137) } });
    estudiantes.push({ ...u, tipo });
  }
  for (const [usuario, nombre, rolCultura] of PERSONAL) {
    const email = `demo.${usuario}@uniautonoma.edu.co`;
    const u = await prisma.usuario.create({ data: { emailInstitucional: email, nombre, rolId: rolAdmin } });
    ids.usuarios.push(u.id);
    await prisma.accesoModulo.create({ data: { email, modulo: "cultura" } });
    ids.accesos.push(email);
    await prisma.rolOperativoCultural.create({ data: { email, rol: rolCultura } });
  }
  guardar();

  // Grupos con inscritos y las sesiones de las ultimas 4 semanas con asistencia.
  const areas = new Map((await prisma.areaCultural.findMany()).map((a) => [a.nombre, a.id]));
  const gruposCreados = new Map();
  for (const [area, nombre, director, lugar, cupo, horario, codigoSnies, inscritos] of GRUPOS) {
    const g = await prisma.grupoCultural.create({
      data: { areaId: areas.get(area), periodo, nombre, director, lugar, cupo, horario, codigoSnies, documentoResponsable: "10617" + String(codigoSnies.length * 9871).slice(0, 5), inscripcionesAbiertas: inscritos.length < cupo },
    });
    ids.grupos.push(g.id);
    gruposCreados.set(nombre, g);
    // Quien dirige y quien apoya cada grupo (el equipo de demostracion).
    const equipoDe = { "Taller de guitarra": ["demo.docente.guitarra@uniautonoma.edu.co", ["demo.monitor.cultura@uniautonoma.edu.co"]], "Grupo de danzas folclóricas": ["demo.docente.danzas@uniautonoma.edu.co", []] }[nombre];
    if (equipoDe) await prisma.grupoCultural.update({ where: { id: g.id }, data: { docenteEmail: equipoDe[0], monitoresEmails: equipoDe[1] } });
    for (const i of inscritos) {
      await prisma.inscripcionCultural.create({ data: { grupoId: g.id, usuarioId: estudiantes[i].id, tipoSnies: estudiantes[i].tipo, ip: ip(), fechaInscripcion: fecha(-40 + i) } });
    }
    for (let n = -28; n < 0; n++) {
      const d = fecha(n);
      const diaSemana = ((d.getUTCDay() + 6) % 7) + 1;
      if (!horario.some((h) => h.dia === diaSemana)) continue;
      const sesion = await prisma.sesionCultural.create({ data: { grupoId: g.id, fecha: d, registradaPor: "demo.monitor.cultura@uniautonoma.edu.co", conteoEstudiantes: n % 3 === 0 ? 4 : 0 } });
      for (const i of inscritos) {
        if ((i + n) % 4 === 0) continue; // algunas faltas
        const conCodigo = (i + n) % 3 !== 0;
        await prisma.asistenciaCultural.create({ data: { sesionId: sesion.id, usuarioId: estudiantes[i].id, tipoSnies: estudiantes[i].tipo, ip: ip(), origen: conCodigo ? "Codigo" : "Personal", fechaHora: new Date(d.getTime() + 19 * 3600 * 1000) } });
      }
    }
  }
  guardar();

  // Inscripciones a la agenda que ya existe (sin crear eventos nuevos).
  const eventos = await prisma.eventoCultural.findMany({ where: { estado: "Publicado" }, orderBy: { fecha: "asc" } });
  const hoy = fecha(0);
  for (const [k, e] of eventos.entries()) {
    const pasado = e.fecha < hoy;
    const cuantos = Math.min(e.cupo, 3 + (k % 5));
    for (let j = 0; j < cuantos; j++) {
      const est = estudiantes[(k * 3 + j) % estudiantes.length];
      const existe = await prisma.inscripcionEventoCultural.findUnique({ where: { eventoId_usuarioId: { eventoId: e.id, usuarioId: est.id } } });
      if (existe) continue;
      const asistio = pasado ? j % 4 !== 3 : null;
      const ins = await prisma.inscripcionEventoCultural.create({
        data: { eventoId: e.id, usuarioId: est.id, tipoSnies: est.tipo, ip: ip(), asistio, ipAsistencia: asistio ? ip() : null, fechaAsistencia: asistio ? new Date(e.fecha.getTime() + 20 * 3600 * 1000) : null },
      });
      ids.eventosInscripciones.push(ins.id);
    }
    // Publico sin cuenta en los eventos que ya pasaron (solo si estaba en cero).
    if (pasado && !e.conteoEstudiantes && !e.conteoDocentes) {
      await prisma.eventoCultural.update({ where: { id: e.id }, data: { conteoEstudiantes: 35 + k * 7, conteoDocentes: 4, conteoAdministrativos: 6 } });
      ids.conteosEventos.push(e.id);
    }
  }
  guardar();

  // Convocatorias con postulaciones.
  const audiciones = await prisma.convocatoriaCultural.create({ data: { titulo: "Audiciones Uniautónoma Band 2026-2", descripcion: "Buscamos voz, bajo y batería. Trae una canción preparada.", cierra: fecha(10), cupo: 6, estado: "Abierta", grupoId: gruposCreados.get("Uniautónoma Band").id } });
  const casting = await prisma.convocatoriaCultural.create({ data: { titulo: "Casting Teatro Sinapsis: obra de fin de año", descripcion: "Papeles para la muestra de diciembre.", cierra: fecha(-5), cupo: 8, estado: "Cerrada", grupoId: gruposCreados.get("Teatro Sinapsis").id } });
  ids.convocatorias.push(audiciones.id, casting.id);
  const postular = (c, i, motivacion, estado) => prisma.postulacionCultural.create({ data: { convocatoriaId: c.id, usuarioId: estudiantes[i].id, motivacion, estado, tipoSnies: estudiantes[i].tipo, ip: ip() } });
  await postular(audiciones, 6, "Canto desde el colegio y quiero representar a la universidad.", "Recibida");
  await postular(audiciones, 9, "Toco batería en una banda de mi barrio.", "Recibida");
  await postular(audiciones, 2, "Toco bajo hace dos años.", "Aceptada");
  await postular(casting, 4, "Me gustaría actuar en la muestra.", "Aceptada");
  await postular(casting, 7, "Hice teatro en el colegio.", "Rechazada");
  guardar();

  // Delegaciones a redes (una con oficio adjunto).
  const representar = async (red, nombre, modalidad, n, grupo, posicion, participantes) => {
    const r = await prisma.representacionRed.create({ data: { red, nombre, modalidad, fecha: fecha(n), grupoId: gruposCreados.get(grupo)?.id || null, posicion } });
    ids.representaciones.push(r.id);
    for (const i of participantes) await prisma.participanteRed.create({ data: { representacionId: r.id, usuarioId: estudiantes[i].id } });
    return r;
  };
  await representar("ASCUN", "Festival regional de la canción, nodo suroccidente", "Intérprete solista femenino", -45, "Uniautónoma Band", "3.er lugar", [6]);
  await representar("ASCUN", "Festival regional de la canción, nodo suroccidente", "Canción inédita", -45, "Uniautónoma Band", null, [1, 13]);
  const globalFest = await representar("ASIES", "Global Fest", "Danza folclórica", 2, "Grupo de danzas folclóricas", null, [2, 4, 6, 10]);
  await representar("ASIES", "Encuentro departamental de teatro universitario", "Montaje corto", -120, "Teatro Sinapsis", "Mención especial", [0, 5, 8]);
  fs.mkdirSync(CARPETA, { recursive: true });
  const archivo = `${crypto.randomUUID()}.pdf`;
  fs.writeFileSync(path.join(CARPETA, archivo), pdfOficio("Oficio de invitacion: Global Fest - Red ASIES (dato de prueba)"));
  ids.archivos.push(archivo);
  const oficio = await prisma.evidenciaCultural.create({ data: { representacionId: globalFest.id, tipo: "oficio", archivo, nombreOriginal: "Oficio invitación Global Fest ASIES.pdf", mime: "application/pdf", subidoPor: MARCA } });
  ids.evidencias.push(oficio.id);
  guardar();

  // Pausas creativas (arte itinerante).
  for (const [n, horaInicio, horaFin, lugar, tecnica, impacto] of [[-20, "10:00", "11:30", "Cafetería", "Origami", 18], [-13, "14:00", "15:00", "Biblioteca", "Dibujo a ciegas", 12], [-6, "12:00", "13:30", "Plazoleta central", "Pintura en piedra", 25], [-2, "10:30", "12:00", "Cafetería", "Pulseras tejidas", 15]]) {
    const p = await prisma.pausaCreativa.create({ data: { fecha: fecha(n), horaInicio, horaFin, lugar, tecnica, impactoEstimado: impacto, registradaPor: MARCA } });
    ids.pausas.push(p.id);
  }

  // Solicitudes de apoyo (Mercadeo, colegios y ferias).
  for (const [destino, n, hora, grupo, detalle, personal, estado] of [
    ["Colegio Champagnat", -9, "09:00", "Uniautónoma Band", "Promoción de programas para grado 11. Pide Mercadeo.", "Mauricio Hoyos y la banda", "Realizada"],
    ["Feria universitaria de Popayán", 6, "08:00", "Grupo de danzas folclóricas", "Stand de la universidad; presentación de 15 minutos.", "Paola Castillo", "Programada"],
    ["Institución Educativa Liceo Nacional", 14, "10:00", null, "Charla y muestra artística para grado 10.", null, "Recibida"],
  ]) {
    const s = await prisma.solicitudApoyo.create({ data: { lugarDestino: destino, fecha: fecha(n), hora, grupoId: gruposCreados.get(grupo)?.id || null, detalle, personalAsignado: personal, estado, solicitadaPor: MARCA } });
    ids.solicitudes.push(s.id);
  }
  guardar();

  // Inventario y prestamos.
  const articulo = async (nombre, categoria, cantidadTotal, ubicacion, grupo, cantidadDanada = 0) => {
    const a = await prisma.articuloCultural.create({ data: { nombre, categoria, cantidadTotal, cantidadDanada, ubicacion, grupoId: gruposCreados.get(grupo)?.id || null } });
    ids.articulos.push(a.id);
    return a;
  };
  const guitarras = await articulo("Guitarra acústica", "instrumento", 6, "Salón de música 2", "Taller de guitarra", 1);
  await articulo("Teclado Yamaha", "instrumento", 2, "Salón de música 1", "Taller de piano");
  const microfonos = await articulo("Micrófono inalámbrico", "equipo", 4, "Bodega de Cultura", "Uniautónoma Band");
  await articulo("Parlante activo 15\"", "equipo", 2, "Bodega de Cultura", null);
  const vestidos = await articulo("Vestido de cumbia", "vestuario", 12, "Bodega de vestuario", "Grupo de danzas folclóricas");
  await articulo("Sombrero vueltiao", "vestuario", 12, "Bodega de vestuario", "Grupo de danzas folclóricas");
  await articulo("Máscaras de teatro", "vestuario", 10, "Auditorio", "Teatro Sinapsis");
  const prestar = (a, cantidad, responsable, grupo, motivo, n) =>
    prisma.prestamoCultural.create({ data: { articuloId: a.id, cantidad, responsable, grupoId: gruposCreados.get(grupo)?.id || null, motivo, fechaDevolucionEsperada: fecha(n), registradoPor: MARCA } });
  await prestar(vestidos, 8, "Paola Castillo", "Grupo de danzas folclóricas", "Global Fest", 4);
  await prestar(microfonos, 2, "Mauricio Hoyos", "Uniautónoma Band", "Clínica La Estancia", 18);
  await prestar(guitarras, 1, "Santiago Erazo Paz", "Taller de guitarra", "Práctica en casa", -3);
  guardar();

  // Pendientes de logistica y entregas, ligados a la agenda real cuando existe.
  const eventoPorNombre = new Map(eventos.map((e) => [e.nombre, e.id]));
  for (const [titulo, categoria, n, responsable, evento, red, hecha, detalle] of [
    ["Recoger y subir las fotos de Halloween", "otro", -2, "Felipe Rengifo", "Halloween: evento de niños", null, false, null],
    ["Confirmar vestuario completo para Global Fest", "logistica", 1, "Paola Castillo", null, globalFest.id, false, "Faltan 2 sombreros por revisar."],
    ["Gestionar bus para Teatro en Timbío", "logistica", 2, "Coordinación", "Teatro en Timbío", null, false, "Salida 7:00 a. m. desde la sede principal, 15 personas."],
    ["Responder el oficio de ASIES", "otro", -4, "Coordinación", null, globalFest.id, true, null],
    ["Entregar el informe SNIES", "informe", 12, "Coordinación", null, null, false, "Descargar desde Informes y revisar los códigos de cada actividad."],
    ["Pedir sonido para Clínica La Estancia", "logistica", 15, "Mauricio Hoyos", "Clínica La Estancia: Uniautónoma Band", null, false, null],
    ["Inventario de fin de semestre", "inventario", 16, "Felipe Rengifo", null, null, false, "Contar instrumentos y vestuario; anotar lo dañado."],
  ]) {
    const t = await prisma.tareaCultural.create({
      data: { titulo, categoria, fechaLimite: fecha(n), responsable, detalle, eventoId: evento ? eventoPorNombre.get(evento) || null : null, representacionId: red, hecha, fechaHecha: hecha ? new Date() : null, creadaPor: MARCA },
    });
    ids.tareas.push(t.id);
  }
  guardar();

  console.log(`Listo: ${estudiantes.length} personas inscritas, ${PERSONAL.length} del equipo (2 docentes y 1 monitor), ${ids.grupos.length} grupos con asistencia, ${ids.eventosInscripciones.length} inscripciones a la agenda, 2 convocatorias, ${ids.representaciones.length} delegaciones (una con oficio), ${ids.pausas.length} pausas, ${ids.solicitudes.length} solicitudes de apoyo, ${ids.articulos.length} artículos con 3 préstamos y ${ids.tareas.length} pendientes.`);
}

async function limpiar() {
  if (!fs.existsSync(REGISTRO)) {
    console.log("No hay datos de prueba que borrar.");
    return;
  }
  const ids = JSON.parse(fs.readFileSync(REGISTRO, "utf8"));
  const enUsuarios = { usuarioId: { in: ids.usuarios } };
  await prisma.tareaCultural.deleteMany({ where: { id: { in: ids.tareas } } });
  await prisma.prestamoCultural.deleteMany({ where: { articuloId: { in: ids.articulos } } });
  await prisma.articuloCultural.deleteMany({ where: { id: { in: ids.articulos } } });
  await prisma.solicitudApoyo.deleteMany({ where: { id: { in: ids.solicitudes } } });
  await prisma.evidenciaCultural.deleteMany({ where: { id: { in: ids.evidencias } } });
  await prisma.pausaCreativa.deleteMany({ where: { id: { in: ids.pausas } } });
  for (const archivo of ids.archivos) fs.rmSync(path.join(CARPETA, archivo), { force: true });
  await prisma.participanteRed.deleteMany({ where: { representacionId: { in: ids.representaciones } } });
  await prisma.representacionRed.deleteMany({ where: { id: { in: ids.representaciones } } });
  await prisma.postulacionCultural.deleteMany({ where: { convocatoriaId: { in: ids.convocatorias } } });
  await prisma.convocatoriaCultural.deleteMany({ where: { id: { in: ids.convocatorias } } });
  await prisma.inscripcionEventoCultural.deleteMany({ where: { id: { in: ids.eventosInscripciones } } });
  await prisma.eventoCultural.updateMany({ where: { id: { in: ids.conteosEventos } }, data: { conteoEstudiantes: 0, conteoDocentes: 0, conteoAdministrativos: 0, conteoEgresados: 0 } });
  // Lo que alguien haya hecho a mano con las cuentas de prueba, tambien se va.
  await prisma.asistenciaCultural.deleteMany({ where: enUsuarios });
  await prisma.sesionCultural.deleteMany({ where: { grupoId: { in: ids.grupos } } });
  await prisma.inscripcionCultural.deleteMany({ where: { OR: [enUsuarios, { grupoId: { in: ids.grupos } }] } });
  await prisma.inscripcionEventoCultural.deleteMany({ where: enUsuarios });
  await prisma.postulacionCultural.deleteMany({ where: enUsuarios });
  await prisma.participanteRed.deleteMany({ where: enUsuarios });
  await prisma.evidenciaCultural.updateMany({ where: { grupoId: { in: ids.grupos } }, data: { grupoId: null } });
  await prisma.eventoCultural.updateMany({ where: { grupoId: { in: ids.grupos } }, data: { grupoId: null } });
  await prisma.grupoCultural.deleteMany({ where: { id: { in: ids.grupos } } });
  await prisma.perfilCultural.deleteMany({ where: enUsuarios });
  await prisma.rolOperativoCultural.deleteMany({ where: { email: { in: ids.accesos } } });
  await prisma.accesoModulo.deleteMany({ where: { email: { in: ids.accesos } } });
  await prisma.usuario.deleteMany({ where: { id: { in: ids.usuarios } } });
  fs.unlinkSync(REGISTRO);
  console.log("Se borraron los datos de prueba de Arte y Cultura.");
}

(process.argv[2] === "limpiar" ? limpiar() : cargar())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
