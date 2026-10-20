// Modulo Deporte, requisitos del F-02 PISU: docentes asignados a grupos
// (RF-004, RF-007, RF-013 a RF-016, RN-004), categorias y restricciones
// (RF-005, RF-008, RN-002), eventos deportivos (RF-002, RF-018, RF-020),
// comunicados (RF-011), ocupacion (RF-012) y horario con asistencia (RF-022).

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno();

// Reloj fijo a las 7:00 a. m. de hoy (hora de Bogota, en medio de las clases de 6 a 8) para que las reglas de hora
// (la asistencia se activa a la hora de inicio) no dependan de cuando corran las pruebas.
const ahoraReal = new Date(Date.now() - 5 * 3600e3);
const MEDIODIA = Date.UTC(ahoraReal.getUTCFullYear(), ahoraReal.getUTCMonth(), ahoraReal.getUTCDate(), 12, 0);
beforeAll(() => jest.useFakeTimers({ now: MEDIODIA, doNotFake: ["nextTick", "setImmediate", "clearImmediate", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "queueMicrotask", "hrtime", "performance"] }));
afterAll(() => jest.useRealTimers());

const request = require("supertest");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const { hoyBogota } = require("../src/common/utils/fechas");
const { diaSemana } = require("../src/modules/deporte/utils");

const hoy = () => hoyBogota().toISOString().slice(0, 10);
const enDias = (n) => new Date(hoyBogota().getTime() + n * 864e5).toISOString().slice(0, 10);
const diaHoy = () => diaSemana(hoyBogota());

let coord;
let laura;
let andres;
let carlos;
let natacion;
beforeEach(async () => {
  prisma.__reset();
  coord = crearUsuario("Administrador", "deportes@uniautonoma.edu.co", "Coordinación de Deportes");
  prisma.__darAcceso("deportes@uniautonoma.edu.co", "deporte");
  laura = crearUsuario("Estudiante", "laura.munoz@uniautonoma.edu.co", "Laura Muñoz");
  andres = crearUsuario("Estudiante", "andres.gomez@uniautonoma.edu.co", "Andrés Gómez");
  carlos = crearUsuario("Estudiante", "carlos.ruiz@uniautonoma.edu.co", "Carlos Ruiz");
  natacion = await prisma.disciplinaDeportiva.create({ data: { nombre: "Natación", tipo: "Individual" } });
});

const adm = (metodo, ruta) => request(app)[metodo](`/api/v1/deporte/admin${ruta}`).set(auth(coord.token));
const doc = (metodo, ruta, token = carlos.token) => request(app)[metodo](`/api/v1/deporte/docente${ruta}`).set(auth(token));
const est = (metodo, ruta, token = laura.token) => request(app)[metodo](`/api/v1/deporte${ruta}`).set(auth(token));

async function grupo(datos = {}) {
  const res = await adm("post", "/grupos").send({
    disciplinaId: natacion.id,
    nombre: "Natación · Grupo 1",
    cupo: 10,
    horario: [{ dia: diaHoy(), inicio: "06:00", fin: "08:00" }],
    ...datos,
  });
  expect(res.status).toBe(201);
  return res.body.grupo;
}

async function registrarCarlos() {
  const res = await adm("post", "/docentes").send({ email: "Carlos.Ruiz@uniautonoma.edu.co", nombre: "Carlos Ruiz", especialidad: "Natación" });
  expect(res.status).toBe(201);
  return res.body.docente;
}

describe("Docentes (RF-004, RF-007)", () => {
  it("registra docentes con correo institucional y les da acceso a su panel", async () => {
    expect((await adm("post", "/docentes").send({ email: "no-es-correo", nombre: "X" })).status).toBe(400);
    const d = await registrarCarlos();
    expect(d.email).toBe("carlos.ruiz@uniautonoma.edu.co");
    expect((await adm("post", "/docentes").send({ email: "carlos.ruiz@uniautonoma.edu.co", nombre: "Otra vez" })).body.codigo).toBe("DOCENTE_REPETIDO");
    expect(await prisma.accesoModulo.findFirst({ where: { email: d.email, modulo: "deporte-docente" } })).toBeTruthy();

    const inicio = await doc("get", "/inicio");
    expect(inicio.status).toBe(200);
    expect(inicio.body.docente.nombre).toBe("Carlos Ruiz");
    // No entra al panel de la coordinacion.
    expect((await request(app).get("/api/v1/deporte/admin/resumen").set(auth(carlos.token))).status).toBe(403);

    // Al desactivarlo pierde el acceso.
    await adm("patch", `/docentes/${d.id}`).send({ activo: false });
    expect((await doc("get", "/inicio")).status).toBe(403);
  });

  it("carga docentes desde CSV e informa las filas con error", async () => {
    await registrarCarlos();
    const csv = "correo;nombre;telefono;especialidad\ndiana.ortiz@uniautonoma.edu.co;Diana Ortiz;3001234567;Running\ncarlos.ruiz@uniautonoma.edu.co;Carlos A. Ruiz;;Natación\nsin-arroba;Alguien;;\n;Sin correo;;";
    const res = await adm("post", "/docentes/csv").send({ contenido: csv });
    expect(res.body).toMatchObject({ creados: 1, actualizados: 1 });
    expect(res.body.errores.map((e) => e.linea)).toEqual([4, 5]);
    const lista = (await adm("get", "/docentes")).body.docentes;
    expect(lista.map((x) => x.nombre)).toEqual(["Carlos A. Ruiz", "Diana Ortiz"]);
  });

  it("no asigna a un docente dos grupos que se cruzan", async () => {
    const d = await registrarCarlos();
    await grupo({ docenteId: d.id });
    const res = await adm("post", "/grupos").send({ disciplinaId: natacion.id, nombre: "Natación · Grupo 2", docenteId: d.id, horario: [{ dia: diaHoy(), inicio: "07:00", fin: "09:00" }] });
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe("CRUCE_DOCENTE");
    const libre = await grupo({ nombre: "Natación · Grupo 3", docenteId: d.id, horario: [{ dia: diaHoy(), inicio: "08:00", fin: "10:00" }] });
    expect(libre.docente.nombre).toBe("Carlos Ruiz");
  });
});

it("acepta docentes externos con correo no institucional", async () => {
  const res = await adm("post", "/docentes").send({ email: "entrenador.externo@gmail.com", nombre: "Entrenador Externo" });
  expect(res.status).toBe(201);
  const lista = (await adm("get", "/docentes")).body.docentes;
  expect(lista[0]).toMatchObject({ email: "entrenador.externo@gmail.com", externo: true, haIngresado: false });
});

describe("Panel del docente (RF-013 a RF-016, RN-004)", () => {
  it("solo ve sus grupos y toma o corrige la asistencia solo mientras dura la clase", async () => {
    const d = await registrarCarlos();
    const propio = await grupo({ docenteId: d.id });
    const ajeno = await grupo({ nombre: "Natación · Grupo 2", horario: [{ dia: diaHoy(), inicio: "18:00", fin: "19:00" }] });
    await adm("post", `/grupos/${propio.id}/inscritos`).send({ email: "laura.munoz@uniautonoma.edu.co" });

    const inicio = await doc("get", "/inicio");
    expect(inicio.body.grupos.map((g) => g.id)).toEqual([propio.id]);
    expect((await doc("get", `/grupos/${ajeno.id}`)).status).toBe(403);
    expect((await doc("post", `/grupos/${ajeno.id}/sesiones`).send({ fecha: hoy(), inicio: "18:00", fin: "19:00", presentes: [] })).body.codigo).toBe("GRUPO_AJENO");

    const tomada = await doc("post", `/grupos/${propio.id}/sesiones`).send({ fecha: hoy(), inicio: "06:00", fin: "08:00", presentes: [laura.usuario.id] });
    expect(tomada.status).toBe(201);
    const sesion = tomada.body.grupo.sesiones[0];
    expect((await doc("put", `/sesiones/${sesion.id}`).send({ presentes: [] })).status).toBe(200);

    // Una clase que ya terminó no se puede corregir ni registrar (ni el docente ni la coordinación).
    const vieja = await prisma.sesionDeporte.create({ data: { grupoId: propio.id, fecha: new Date(`${enDias(-3)}T00:00:00Z`), inicio: "06:00", fin: "08:00", horas: 2 } });
    const tarde = await doc("put", `/sesiones/${vieja.id}`).send({ presentes: [laura.usuario.id] });
    expect(tarde.status).toBe(409);
    expect(tarde.body.codigo).toBe("VENTANA_CERRADA");
    expect((await doc("post", `/grupos/${propio.id}/sesiones`).send({ fecha: enDias(-4), inicio: "06:00", fin: "08:00", presentes: [] })).body.codigo).toBe("VENTANA_CERRADA");
    expect((await adm("put", `/sesiones/${vieja.id}`).send({ presentes: [laura.usuario.id] })).body.codigo).toBe("VENTANA_CERRADA");
    // Una clase de hoy que ya terminó (5:30 a 6:30, son las 7:00) tampoco.
    const terminada = await prisma.sesionDeporte.create({ data: { grupoId: propio.id, fecha: new Date(`${hoy()}T00:00:00Z`), inicio: "05:30", fin: "06:30", horas: 0.5 } });
    expect((await doc("put", `/sesiones/${terminada.id}`).send({ presentes: [laura.usuario.id] })).body.codigo).toBe("VENTANA_CERRADA");
  });

  it("envía comunicados solo a sus grupos", async () => {
    const d = await registrarCarlos();
    const propio = await grupo({ docenteId: d.id });
    const ajeno = await grupo({ nombre: "Natación · Grupo 2", horario: [{ dia: diaHoy(), inicio: "18:00", fin: "19:00" }] });
    expect((await doc("post", "/alertas").send({ grupoId: ajeno.id, titulo: "Hola", mensaje: "x" })).status).toBe(403);
    const ok = await doc("post", "/alertas").send({ grupoId: propio.id, titulo: "Clase en la piscina 2", mensaje: "Mañana nos vemos en la piscina 2." });
    expect(ok.status).toBe(201);
    expect(ok.body.alerta).toMatchObject({ alcance: "Grupo", destino: "Natación · Grupo 1" });
  });
});

describe("Categorías y restricciones (RF-005, RF-008, RN-002)", () => {
  it("solo deja inscribir a las categorías permitidas en la disciplina", async () => {
    const g = await grupo();
    await adm("patch", `/disciplinas/${natacion.id}`).send({ categorias: ["Posgrado", "Egresado"] });

    const oferta = await est("get", "/oferta");
    expect(oferta.body.categoria).toBe("Pregrado");
    expect(oferta.body.disciplinas[0].restriccion).toMatch(/posgrado y egresado/);
    const negada = await est("post", `/grupos/${g.id}/inscripcion`);
    expect(negada.status).toBe(409);
    expect(negada.body.codigo).toBe("CATEGORIA_NO_PERMITIDA");

    expect((await adm("put", `/estudiantes/${laura.usuario.id}/categoria`).send({ categoria: "Doctorado" })).status).toBe(400);
    const cambio = await adm("put", `/estudiantes/${laura.usuario.id}/categoria`).send({ categoria: "Posgrado" });
    expect(cambio.body.estudiante.categoria).toBe("Posgrado");
    expect((await est("post", `/grupos/${g.id}/inscripcion`)).status).toBe(201);
  });

  it("todas las categorías marcadas equivale a sin restricción", async () => {
    const res = await adm("patch", `/disciplinas/${natacion.id}`).send({ categorias: ["Pregrado", "Posgrado", "Egresado"] });
    expect(res.body.disciplina.categorias).toEqual([]);
  });
});

describe("Eventos deportivos (RF-002, RF-018, RF-020)", () => {
  it("publica, inscribe con cupo y reconoce horas a quien asiste", async () => {
    const creado = await adm("post", "/eventos").send({ nombre: "Torneo relámpago de natación", tipo: "Torneo", disciplinaId: natacion.id, fecha: hoy(), horaInicio: "06:30", horaFin: "09:00", lugar: "Piscina", cupo: 1, horasReconocidas: 4 });
    expect(creado.status).toBe(201);
    const id = creado.body.evento.id;

    const lista = await est("get", "/eventos");
    expect(lista.body.eventos[0]).toMatchObject({ nombre: "Torneo relámpago de natación", inscripcionAbierta: true, inscrito: false });
    expect((await est("post", `/eventos/${id}/inscripcion`)).status).toBe(201);
    expect((await est("post", `/eventos/${id}/inscripcion`, andres.token)).body.codigo).toBe("SIN_CUPO");

    const asistencia = await adm("put", `/eventos/${id}/asistencia`).send({ presentes: [laura.usuario.id] });
    expect(asistencia.body.evento.estado).toBe("Finalizado");
    const horas = await est("get", "/mis-horas");
    expect(horas.body.total).toBe(4);
    expect(horas.body.historial[0]).toMatchObject({ tipo: "evento", horas: 4 });
  });

  it("valida categoría, fechas y estado del evento", async () => {
    expect((await adm("post", "/eventos").send({ nombre: "Viejo", fecha: enDias(-1), horaInicio: "08:00", horaFin: "09:00" })).status).toBe(400);
    expect((await adm("post", "/eventos").send({ nombre: "X", fecha: enDias(3), fechaLimite: enDias(5), horaInicio: "08:00", horaFin: "09:00" })).status).toBe(400);
    const solo = await adm("post", "/eventos").send({ nombre: "Masterclass egresados", tipo: "Masterclass", fecha: enDias(3), horaInicio: "08:00", horaFin: "09:00", categorias: ["Egresado"] });
    expect((await est("post", `/eventos/${solo.body.evento.id}/inscripcion`)).body.codigo).toBe("CATEGORIA_NO_PERMITIDA");
    const borrador = await adm("post", "/eventos").send({ nombre: "Borrador", fecha: enDias(3), horaInicio: "08:00", horaFin: "09:00", estado: "Borrador" });
    expect((await est("get", "/eventos")).body.eventos.map((e) => e.id)).not.toContain(borrador.body.evento.id);
  });
});

describe("Comunicados (RF-011)", () => {
  it("llegan a todos, a una disciplina o a un grupo según su alcance", async () => {
    const g = await grupo();
    await est("post", `/grupos/${g.id}/inscripcion`);
    await adm("post", "/alertas").send({ titulo: "Cierre de piscina", mensaje: "El lunes no hay clase.", alcance: "Grupo", grupoId: g.id, prioridad: "Urgente" });
    await adm("post", "/alertas").send({ titulo: "Semana deportiva", mensaje: "Inscríbete a los torneos.", alcance: "Todos" });
    expect((await adm("post", "/alertas").send({ titulo: "X", mensaje: "Y", alcance: "Grupo" })).status).toBe(400);

    const deLaura = (await est("get", "/avisos")).body.avisos;
    expect(deLaura.map((a) => a.titulo)).toEqual(["Cierre de piscina", "Semana deportiva"]);
    const deAndres = (await est("get", "/avisos", andres.token)).body.avisos;
    expect(deAndres.map((a) => a.titulo)).toEqual(["Semana deportiva"]);

    const lista = (await adm("get", "/alertas")).body.alertas;
    expect(lista.find((a) => a.titulo === "Cierre de piscina").alcanzados).toBe(1);
  });
});

describe("Ocupación y horario del estudiante (RF-012, RF-022)", () => {
  it("resume cupos ocupados y libres, y el porcentaje de asistencia del estudiante", async () => {
    const g = await grupo({ cupo: 4 });
    await est("post", `/grupos/${g.id}/inscripcion`);
    await est("post", `/grupos/${g.id}/inscripcion`, andres.token);
    const resumen = (await adm("get", "/resumen")).body;
    expect(resumen.ocupacion).toMatchObject({ cupos: 4, ocupados: 2, libres: 2, porcentaje: 50 });
    expect(resumen.ocupacion.porGrupo[0]).toMatchObject({ nombre: "Natación · Grupo 1", libres: 2 });

    await adm("post", `/grupos/${g.id}/sesiones`).send({ fecha: hoy(), inicio: "06:00", fin: "08:00", presentes: [laura.usuario.id] });
    await prisma.sesionDeporte.create({ data: { grupoId: g.id, fecha: new Date(`${enDias(-7)}T00:00:00Z`), inicio: "06:00", fin: "08:00", horas: 2 } }).then((s) =>
      prisma.asistenciaDeporte.create({ data: { sesionId: s.id, usuarioId: laura.usuario.id, presente: false } })
    );
    const mis = (await est("get", "/mis-horas")).body;
    expect(mis.grupos[0].asistencia).toMatchObject({ clases: 2, presentes: 1, fallas: 1, porcentaje: 50 });
  });
});

describe("Inventario de implementos", () => {
  const crear = (datos = {}) => adm("post", "/inventario").send({ nombre: "Balón de voleibol", codigo: "vol-01", disciplinaId: natacion.id, ubicacion: "Bodega coliseo", cantidad: 10, stockMinimo: 3, ...datos });

  it("registra existencias, presta, devuelve con daños y pérdidas y deja trazabilidad", async () => {
    const r = await crear();
    expect(r.status).toBe(201);
    const id = r.body.implemento.id;
    expect(r.body.implemento).toMatchObject({ codigo: "VOL-01", cantidadTotal: 10, disponibles: 10 });
    expect((await crear({ nombre: "Otro" })).status).toBe(409);

    const prestado = await adm("post", `/inventario/${id}/prestamos`).send({ cantidad: 8, tipoResponsable: "Docente", responsable: "Carlos Ruiz", fechaDevolucionEsperada: enDias(2) });
    expect(prestado.body.implemento).toMatchObject({ enPrestamo: 8, disponibles: 2, bajoStock: true });
    expect((await adm("post", `/inventario/${id}/prestamos`).send({ cantidad: 3, responsable: "Laura", fechaDevolucionEsperada: enDias(1) })).body.codigo).toBe("SIN_EXISTENCIAS");

    const prestamo = prestado.body.implemento.prestamos[0];
    expect((await adm("post", `/prestamos/${prestamo.id}/devolucion`).send({ devueltosDanados: 1, perdidos: 1 })).status).toBe(400); // falta la observacion
    const devuelto = await adm("post", `/prestamos/${prestamo.id}/devolucion`).send({ devueltosDanados: 1, perdidos: 1, observacion: "Uno se pinchó y otro no apareció" });
    expect(devuelto.body.implemento).toMatchObject({ cantidadTotal: 9, cantidadDanada: 1, enPrestamo: 0, disponibles: 8 });
    expect((await adm("post", `/prestamos/${prestamo.id}/devolucion`).send({})).status).toBe(409);

    await adm("post", `/inventario/${id}/movimientos`).send({ tipo: "Reparacion", cantidad: 1, motivo: "Parcheado" });
    const baja = await adm("post", `/inventario/${id}/movimientos`).send({ tipo: "Baja", cantidad: 2, motivo: "Desgaste" });
    expect(baja.body.implemento).toMatchObject({ cantidadTotal: 7, disponibles: 7 });
    expect(baja.body.implemento.movimientos.map((m) => m.tipo)).toEqual(expect.arrayContaining(["Ingreso", "Prestamo", "Devolucion", "Reparacion", "Baja"]));
    expect(baja.body.implemento.movimientos[0].registradoPor).toBe("deportes@uniautonoma.edu.co");
  });

  it("resume el inventario, marca préstamos vencidos y exporta Excel", async () => {
    const id = (await crear()).body.implemento.id;
    const p = await adm("post", `/inventario/${id}/prestamos`).send({ cantidad: 2, responsable: "Laura Muñoz", fechaDevolucionEsperada: hoy() });
    await prisma.prestamoImplemento.update({ where: { id: p.body.implemento.prestamos[0].id }, data: { fechaDevolucionEsperada: new Date(`${enDias(-2)}T00:00:00Z`) } });
    const inv = (await adm("get", "/inventario")).body;
    expect(inv.resumen).toMatchObject({ referencias: 1, unidades: 10, enPrestamo: 2, prestamosVencidos: 1 });
    expect(inv.prestamos[0]).toMatchObject({ implemento: "Balón de voleibol", vencido: true });
    const excel = await adm("get", "/inventario/reporte");
    expect(excel.status).toBe(200);
    expect(excel.headers["content-type"]).toMatch(/spreadsheet/);
  });

  it("solo la coordinación maneja el inventario", async () => {
    await registrarCarlos();
    expect((await request(app).get("/api/v1/deporte/admin/inventario").set(auth(carlos.token))).status).toBe(403);
  });
});

describe("La asistencia se activa a la hora de inicio", () => {
  it("no deja tomar la asistencia de una clase o un evento que aún no empieza", async () => {
    const g = await grupo({ nombre: "Natación · Grupo 9", horario: [{ dia: diaHoy(), inicio: "07:30", fin: "08:30" }] });
    const temprano = await adm("post", `/grupos/${g.id}/sesiones`).send({ fecha: hoy(), inicio: "07:30", fin: "08:30", presentes: [] });
    expect(temprano.status).toBe(409);
    expect(temprano.body.codigo).toBe("ASISTENCIA_AUN_NO");
    const detalle = (await adm("get", `/grupos/${g.id}`)).body.grupo.sugerenciaSesion;
    expect(new Date(detalle.disponibleDesde).getTime()).toBeGreaterThan(Date.now());

    const ev = await adm("post", "/eventos").send({ nombre: "Torneo nocturno", fecha: hoy(), horaInicio: "07:45", horaFin: "09:00" });
    expect((await adm("put", `/eventos/${ev.body.evento.id}/asistencia`).send({ presentes: [] })).body.codigo).toBe("ASISTENCIA_AUN_NO");

    // A la hora de inicio ya se puede.
    jest.setSystemTime(new Date(detalle.disponibleDesde).getTime() + 60e3);
    expect((await adm("post", `/grupos/${g.id}/sesiones`).send({ fecha: hoy(), inicio: "07:30", fin: "08:30", presentes: [] })).status).toBe(201);
    jest.setSystemTime(MEDIODIA);
  });
});
