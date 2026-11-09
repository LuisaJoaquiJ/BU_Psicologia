// Informe de gestion de Arte y Cultura: cifras con asistentes y evidencias, envio al
// superadministrador, revision y descargas en PDF y Excel.
jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const request = require("supertest");
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno();
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const { periodoActual } = require("../src/modules/cultura/periodo");

const binario = (res, cb) => {
  const partes = [];
  res.on("data", (p) => partes.push(p));
  res.on("end", () => cb(null, Buffer.concat(partes)));
};

describe("Informe de gestión de Arte y Cultura", () => {
  const periodo = periodoActual();
  const hoy = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
  let coord;
  let docente;
  let superadmin;
  let ana;
  let beto;
  let grupo;
  let evento;

  const informe = (metodo, ruta = "", quien = coord) => request(app)[metodo](`/api/v1/cultura/admin/informe-gestion${ruta}`).set(auth(quien.token));
  const completo = {
    responsable: "Coordinación de Arte y Cultura",
    logros: "Se abrieron los talleres y se realizó la muestra de danza.",
    dificultades: "Pocos espacios disponibles en la tarde.",
    accionesMejora: "Agendar los salones con anticipación.",
  };

  beforeEach(async () => {
    prisma.__reset();
    coord = crearUsuario("Administrador", "coord.informe@uniautonoma.edu.co", "Coordinación");
    docente = crearUsuario("Administrador", "docente.informe@uniautonoma.edu.co", "Docente");
    superadmin = crearUsuario("SuperAdministrador", "super.informe@uniautonoma.edu.co", "Super");
    ana = crearUsuario("Estudiante", "ana.informe@uniautonoma.edu.co", "Ana Pérez");
    beto = crearUsuario("Estudiante", "beto.informe@uniautonoma.edu.co", "Beto Ruiz");
    prisma.__darAcceso("coord.informe@uniautonoma.edu.co", "cultura");
    prisma.__darAcceso("docente.informe@uniautonoma.edu.co", "cultura");
    await request(app).put("/api/v1/cultura/admin/equipo").set(auth(coord.token)).send({ email: "coord.informe@uniautonoma.edu.co", rol: "administrador" });
    await request(app).put("/api/v1/cultura/admin/equipo").set(auth(coord.token)).send({ email: "docente.informe@uniautonoma.edu.co", rol: "docente" });

    const area = await prisma.areaCultural.create({ data: { nombre: "Danzas", categoria: "taller" } });
    grupo = await prisma.grupoCultural.create({ data: { areaId: area.id, periodo, nombre: "Danzas folclóricas", director: "Paola", cupo: 20, horario: [{ dia: 2, inicio: "14:00", fin: "16:00" }], activo: true } });
    for (const u of [ana, beto]) await prisma.inscripcionCultural.create({ data: { grupoId: grupo.id, usuarioId: u.usuario.id, estado: "Activa", tipoSnies: 1 } });
    await prisma.perfilCultural.create({ data: { usuarioId: ana.usuario.id, tipoSnies: 1, programa: "Ingeniería de Software" } });
    // Dos sesiones: Ana asistió a las dos, Beto a una.
    for (const [i, presentes] of [[0, [ana, beto]], [1, [ana]]]) {
      const fecha = new Date(`${hoy}T00:00:00.000Z`);
      fecha.setUTCDate(fecha.getUTCDate() - i);
      const sesion = await prisma.sesionCultural.create({ data: { grupoId: grupo.id, fecha, conteoEstudiantes: i === 0 ? 2 : 0 } });
      for (const u of presentes) await prisma.asistenciaCultural.create({ data: { sesionId: sesion.id, usuarioId: u.usuario.id, presente: true, tipoSnies: 1, origen: "Personal" } });
    }
    evento = await prisma.eventoCultural.create({ data: { nombre: "Muestra de danza", fecha: new Date(`${hoy}T00:00:00.000Z`), fechaLimite: new Date(`${hoy}T00:00:00.000Z`), horaInicio: "10:00", horaFin: "12:00", cupo: 50, estado: "Publicado", categoria: "especial", lugar: "Auditorio" } });
    await prisma.inscripcionEventoCultural.create({ data: { eventoId: evento.id, usuarioId: ana.usuario.id, estado: "Activa", tipoSnies: 1, asistio: true } });
    await prisma.inscripcionEventoCultural.create({ data: { eventoId: evento.id, usuarioId: beto.usuario.id, estado: "Activa", tipoSnies: 1, asistio: false } });
  });

  const agregarFoto = () => prisma.evidenciaCultural.create({ data: { eventoId: evento.id, archivo: "no-existe.jpg", nombreOriginal: "muestra.jpg", mime: "image/jpeg", tipo: "fotografia" } });

  test("las cifras traen grupos, asistentes por persona, eventos y evidencias del periodo", async () => {
    await agregarFoto();
    const { cifras, informe: borrador, revision } = (await informe("get", `/${periodo}`)).body;
    expect(borrador).toMatchObject({ estado: "Borrador", modulo: "cultura", editable: true });
    expect(cifras.kpis).toMatchObject({ grupos: 1, talleres: 1, inscritos: 2, personas: 2, sesiones: 2, asistencias: 3, asistentesSinCuenta: 2, eventos: 1, asistentesEventos: 1, evidencias: 1, fotos: 1 });
    const g = cifras.grupos[0];
    expect(g).toMatchObject({ nombre: "Danzas folclóricas", inscritos: 2, sesiones: 2, asistencias: 3, promedio: 1.5, porcentaje: 75 });
    expect(g.asistentes).toEqual([
      { nombre: "Ana Pérez", programa: "Ingeniería de Software", tipo: "Estudiante", sesiones: 2 },
      { nombre: "Beto Ruiz", programa: "—", tipo: "Estudiante", sesiones: 1 },
    ]);
    expect(cifras.eventos[0].asistentes.map((p) => p.nombre)).toEqual(["Ana Pérez"]); // Beto no asistió
    expect(cifras.evidencias[0]).toMatchObject({ actividad: "Muestra de danza", tipoMime: "image/jpeg", tipo: "fotografia" });
    expect(cifras.porTipo.find((t) => t.nombre === "Estudiante").personas).toBe(2);
    expect(revision.listo).toBe(false);
    expect(revision.faltantes).toEqual(expect.arrayContaining(["responsable del proyecto", "logros significativos", "dificultades presentadas"]));
  });

  test("avisa de las actividades sin foto y permite quitar una evidencia", async () => {
    const antes = (await informe("get", `/${periodo}`)).body.revision.avisos.find((x) => x.tipo === "evidencias");
    expect(antes.actividades).toEqual(expect.arrayContaining(["Danzas folclóricas", "Muestra de danza"]));
    const foto = await agregarFoto();
    const con = (await informe("get", `/${periodo}`)).body.revision.avisos.find((x) => x.tipo === "evidencias");
    expect(con.actividades).toEqual(["Danzas folclóricas"]); // el evento ya tiene foto
    expect((await request(app).delete(`/api/v1/cultura/admin/evidencias/${foto.id}`).set(auth(docente.token))).status).toBe(403); // solo la coordinación
    expect((await request(app).delete(`/api/v1/cultura/admin/evidencias/${foto.id}`).set(auth(coord.token))).status).toBe(200);
    expect((await informe("get", `/${periodo}`)).body.cifras.kpis.evidencias).toBe(0);
  });

  test("solo la coordinación maneja el informe", async () => {
    expect((await informe("get", `/${periodo}`, docente)).status).toBe(403);
    expect((await informe("put", `/${periodo}`, docente).send(completo)).status).toBe(403);
    expect((await informe("get", "/2026-9")).status).toBe(400); // periodo no valido
  });

  test("no se envía incompleto; completo se envía, avisa al superadministrador y queda sin edición", async () => {
    await informe("put", `/${periodo}`).send(completo);
    const falta = await informe("post", `/${periodo}/enviar`);
    expect(falta.status).toBe(400);
    expect(falta.body.message).toContain("al menos una foto como evidencia");

    await agregarFoto();
    const enviado = await informe("post", `/${periodo}/enviar`);
    expect(enviado.status).toBe(200);
    expect(enviado.body.informe).toMatchObject({ estado: "Enviado", version: 1, enviadoPor: "coord.informe@uniautonoma.edu.co", editable: false });
    const aviso = (await request(app).get("/api/v1/notificaciones").set(auth(superadmin.token))).body.items.find((n) => n.titulo === "Informe de gestión recibido");
    expect(aviso).toMatchObject({ modulo: "cultura", ruta: "/super/informes" });
    expect((await informe("put", `/${periodo}`).send({ logros: "otro" })).status).toBe(409);
    expect((await informe("post", `/${periodo}/enviar`)).status).toBe(409);
  });

  test("lo enviado es una foto: los datos nuevos no lo cambian; el superadministrador lo ve, lo devuelve y el área lo corrige", async () => {
    await informe("put", `/${periodo}`).send(completo);
    await agregarFoto();
    await informe("post", `/${periodo}/enviar`);
    // Después de enviarlo se sigue registrando asistencia: lo enviado no cambia.
    const sesion = await prisma.sesionCultural.findFirst({ where: { grupoId: grupo.id } });
    await prisma.asistenciaCultural.create({ data: { sesionId: sesion.id, usuarioId: docente.usuario.id, presente: true, tipoSnies: 2, origen: "Personal" } });
    expect((await informe("get", `/${periodo}`)).body.cifras.kpis.asistencias).toBe(3);

    const recibidos = (await request(app).get("/api/v1/super/informes").set(auth(superadmin.token))).body.informes;
    expect(recibidos).toHaveLength(1);
    expect(recibidos[0]).toMatchObject({ modulo: "cultura", estado: "Enviado" });
    expect(recibidos[0].indicadores.map((i) => i.titulo)).toEqual(["Grupos y talleres", "Personas", "Asistencias", "Eventos"]);

    const devuelto = await request(app).patch(`/api/v1/super/informes/${recibidos[0].id}`).set(auth(superadmin.token)).send({ estado: "Devuelto", observacion: "Falta el detalle de la muestra." });
    expect(devuelto.status).toBe(200);
    const avisoCoord = (await request(app).get("/api/v1/notificaciones").set(auth(coord.token))).body.items.find((n) => n.titulo === "Informe de gestión devuelto");
    expect(avisoCoord).toMatchObject({ ruta: "/cultura/informes" });
    expect(avisoCoord.mensaje).toContain("Falta el detalle de la muestra.");

    // Devuelto: se puede editar y reenviar (versión 2).
    expect((await informe("put", `/${periodo}`).send({ dificultades: "Se corrigió." })).status).toBe(200);
    const reenviado = await informe("post", `/${periodo}/enviar`);
    expect(reenviado.body.informe).toMatchObject({ estado: "Enviado", version: 2 });
    expect(reenviado.body.cifras.kpis.asistencias).toBe(4); // ahora sí incluye lo nuevo
  });

  test("se descarga en PDF y Excel, también el superadministrador", async () => {
    await informe("put", `/${periodo}`).send(completo);
    await agregarFoto();
    const pdf = await informe("get", `/${periodo}/archivo?formato=pdf`).buffer(true).parse(binario);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect(pdf.body.subarray(0, 4).toString()).toBe("%PDF");
    const xlsx = await informe("get", `/${periodo}/archivo?formato=xlsx`).buffer(true).parse(binario);
    expect(xlsx.status).toBe(200);
    expect(xlsx.body.subarray(0, 2).toString()).toBe("PK"); // un .xlsx es un zip
    expect((await informe("get", `/${periodo}/archivo?formato=doc`)).status).toBe(400);

    await informe("post", `/${periodo}/enviar`);
    const id = (await request(app).get("/api/v1/super/informes").set(auth(superadmin.token))).body.informes[0].id;
    const desdeSuper = await request(app).get(`/api/v1/super/informes/${id}/archivo?formato=pdf`).set(auth(superadmin.token)).buffer(true).parse(binario);
    expect(desdeSuper.status).toBe(200);
    expect(desdeSuper.body.subarray(0, 4).toString()).toBe("%PDF");
  });
});
