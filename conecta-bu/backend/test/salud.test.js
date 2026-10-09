// Pruebas del modulo Salud integral: registro rapido por documento o codigo,
// personas (Ley 1581), actividades, evidencias, reportes (gestion, SNIES,
// registro general), importador de Excel y citas por modulo.

const os = require("os");
const path = require("path");
const fs = require("fs");

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const { configurarEntorno, crearUsuario, diasDesdeHoy, auth } = require("./helpers");
const DIR_EVIDENCIAS = fs.mkdtempSync(path.join(os.tmpdir(), "cbu-salud-"));
configurarEntorno({ SALUD_UPLOADS_DIR: DIR_EVIDENCIAS });

const request = require("supertest");
const ExcelJS = require("exceljs");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const { hoyBogota } = require("../src/common/utils/fechas");

const hoy = () => hoyBogota().toISOString().slice(0, 10);
const binario = (res, cb) => {
  const partes = [];
  res.on("data", (d) => partes.push(d));
  res.on("end", () => cb(null, Buffer.concat(partes)));
};

// PNG de 1x1 pixel.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

let salud;
beforeEach(() => {
  prisma.__reset();
  salud = crearUsuario("Salud", "enfermeria@uniautonoma.edu.co");
});

const api = (metodo, ruta, token = salud.token) => request(app)[metodo](`/api/v1/salud${ruta}`).set(auth(token));

async function crearActividad(datos = {}) {
  const res = await api("post", "/actividades").send({ nombre: "Tamizaje visual", categoria: "PromocionPrevencion", meta: 2, ...datos });
  expect(res.status).toBe(201);
  return res.body.actividad;
}

async function crearPersona(datos = {}) {
  const res = await api("post", "/personas").send({
    numeroDocumento: "1061731427",
    nombres: "katherine",
    apellidos: "ORDOÑEZ IBARRA",
    poblacion: "Estudiante",
    programa: "INGENIERÍA SOFWARE Y COMPUTACION (INGENIERÍA DE SISTEMAS)",
    codigoEstudiantil: "20231045",
    consentimientoDatos: true,
    ...datos,
  });
  expect(res.status).toBe(201);
  return res.body.persona;
}

describe("Salud integral: acceso", () => {
  test("solo el personal de salud entra al modulo", async () => {
    const est = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const admin = crearUsuario("Administrador", "a@uniautonoma.edu.co");
    expect((await api("get", "/catalogos", est.token)).status).toBe(403);
    expect((await api("get", "/catalogos", admin.token)).status).toBe(403);
    const ok = await api("get", "/catalogos");
    expect(ok.status).toBe(200);
    expect(ok.body.programas.length).toBeGreaterThan(10);
    expect(ok.body.periodoActual).toMatch(/^\d{4}-[12]$/);
  });
});

describe("Salud integral: personas", () => {
  test("exige autorizacion de datos y normaliza nombres y programa", async () => {
    const sin = await api("post", "/personas").send({ numeroDocumento: "123456", nombres: "a", apellidos: "b" });
    expect(sin.status).toBe(400);
    expect(sin.body.codigo).toBe("SIN_CONSENTIMIENTO");

    const persona = await crearPersona();
    expect(persona.nombres).toBe("Katherine");
    expect(persona.apellidos).toBe("Ordoñez Ibarra");
    expect(persona.programa).toBe("Ingeniería de Software y Computación");

    const repetida = await api("post", "/personas").send({ numeroDocumento: "1.061.731.427", nombres: "x", apellidos: "y", consentimientoDatos: true });
    expect(repetida.status).toBe(409);
  });

  test("busca por documento, codigo o nombre", async () => {
    await crearPersona();
    expect((await api("get", "/personas/buscar?q=1.061.731.427")).body.exacta.nombres).toBe("Katherine");
    expect((await api("get", "/personas/buscar?q=20231045")).body.exacta.apellidos).toBe("Ordoñez Ibarra");
    const porNombre = await api("get", "/personas/buscar?q=katherine ordonez");
    expect(porNombre.body.exacta).toBeNull();
    expect(porNombre.body.coincidencias).toHaveLength(1);
  });
});

describe("Salud integral: registro rapido", () => {
  test("registra con solo el documento y guarda poblacion/programa del momento", async () => {
    const persona = await crearPersona();
    const actividad = await crearActividad();
    const res = await api("post", "/atenciones").send({ identificador: " 1061731427 ", actividadId: actividad.id });
    expect(res.status).toBe(201);
    expect(res.body.atencion).toMatchObject({
      personaId: persona.id,
      poblacion: "Estudiante",
      programa: "Ingeniería de Software y Computación",
      registradoPorId: salud.usuario.id,
    });
    expect(res.body.atencion.fecha.slice(0, 10)).toBe(hoy());

    // Misma jornada, misma persona: se avisa en vez de duplicar.
    const otra = await api("post", "/atenciones").send({ identificador: "20231045", actividadId: actividad.id });
    expect(otra.status).toBe(409);
    expect(otra.body.codigo).toBe("YA_REGISTRADA");
    const forzada = await api("post", "/atenciones").send({ identificador: "20231045", actividadId: actividad.id, permitirRepetida: true });
    expect(forzada.status).toBe(201);
  });

  test("si la persona no existe pide registrarla una vez", async () => {
    const actividad = await crearActividad();
    const res = await api("post", "/atenciones").send({ identificador: "99999999", actividadId: actividad.id });
    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe("PERSONA_NO_ENCONTRADA");
  });

  test("atencion de enfermeria con signos vitales validados", async () => {
    await crearPersona();
    const actividad = await crearActividad({ nombre: "Atención básica", categoria: "AtencionEnfermeria", permanente: true, clinica: true });
    const mala = await api("post", "/atenciones").send({ identificador: "1061731427", actividadId: actividad.id, tensionArterial: "alta" });
    expect(mala.status).toBe(400);
    const buena = await api("post", "/atenciones").send({
      identificador: "1061731427",
      actividadId: actividad.id,
      tensionArterial: "120 / 80",
      frecuenciaCardiaca: "76",
      frecuenciaRespiratoria: 19,
      pesoKg: "65,5",
      tallaCm: 175,
      insumo: "Gasas",
      descripcion: "Curación en rodilla derecha",
    });
    expect(buena.status).toBe(201);
    expect(buena.body.atencion).toMatchObject({ tensionArterial: "120/80", frecuenciaCardiaca: 76, pesoKg: 65.5, insumo: "Gasas" });
  });

  test("Ley 1581: una persona importada sin autorizacion debe autorizar en su primera atencion", async () => {
    const actividad = await crearActividad();
    await prisma.personaSalud.create({ data: { numeroDocumento: "555555", nombres: "Ana", apellidos: "Ruiz", consentimientoDatos: false } });
    const sin = await api("post", "/atenciones").send({ identificador: "555555", actividadId: actividad.id });
    expect(sin.status).toBe(409);
    expect(sin.body.codigo).toBe("SIN_CONSENTIMIENTO");
    const con = await api("post", "/atenciones").send({ identificador: "555555", actividadId: actividad.id, consentimientoDatos: true });
    expect(con.status).toBe(201);
    expect(con.body.atencion.persona.consentimientoDatos).toBe(true);
  });

  test("registro en lote para jornadas", async () => {
    await crearPersona();
    await crearPersona({ numeroDocumento: "34569970", codigoEstudiantil: null, nombres: "Paola", apellidos: "Díaz", poblacion: "Administrativo", programa: null });
    const actividad = await crearActividad();
    await api("post", "/atenciones").send({ identificador: "34569970", actividadId: actividad.id });
    const res = await api("post", "/atenciones/lote").send({ actividadId: actividad.id, identificadores: "20231045\n34569970, 777777 20231045" });
    expect(res.status).toBe(201);
    expect(res.body.registrados.map((r) => r.identificador)).toEqual(["20231045"]);
    expect(res.body.yaRegistrados).toHaveLength(1);
    expect(res.body.noEncontrados).toEqual(["777777"]);
  });

  test("no acepta fechas futuras ni de otro periodo", async () => {
    await crearPersona();
    const actividad = await crearActividad();
    const futura = diasDesdeHoy(5).toISOString().slice(0, 10);
    expect((await api("post", "/atenciones").send({ identificador: "1061731427", actividadId: actividad.id, fecha: futura })).status).toBe(400);
    expect((await api("post", "/atenciones").send({ identificador: "1061731427", actividadId: actividad.id, fecha: "2020-03-01" })).status).toBe(400);
  });
});

describe("Salud integral: actividades y evidencias", () => {
  test("indicadores: jornadas, cumplimiento de la meta y codigo SNIES automatico", async () => {
    await crearPersona();
    const a1 = await crearActividad();
    const a2 = await crearActividad({ nombre: "Donación de sangre", categoria: "DonacionSangre" });
    expect(a2.codigo).toBe(a1.codigo + 1);
    await api("post", "/atenciones").send({ identificador: "1061731427", actividadId: a1.id });
    const lista = await api("get", "/actividades");
    const tamizaje = lista.body.actividades.find((a) => a.id === a1.id);
    expect(tamizaje.indicadores).toMatchObject({ asistentes: 1, personas: 1, jornadas: 1, meta: 2, cumplimiento: 50 });
  });

  test("copia el catalogo al siguiente periodo", async () => {
    await crearActividad();
    const { body } = await api("get", "/catalogos");
    const [anio, sem] = body.periodoActual.split("-").map(Number);
    const destino = sem === 1 ? `${anio}-2` : `${anio + 1}-1`;
    const res = await api("post", "/actividades/copiar-periodo").send({ origen: body.periodoActual, destino });
    expect(res.status).toBe(201);
    expect(res.body.copiadas).toBe(1);
    expect((await api("post", "/actividades/copiar-periodo").send({ origen: body.periodoActual, destino })).status).toBe(409);
  });

  test("sube, sirve y elimina evidencias (solo fotos o PDF)", async () => {
    const actividad = await crearActividad();
    const subida = await api("post", `/actividades/${actividad.id}/evidencias`)
      .field("descripcion", "Jornada en la plazoleta")
      .attach("archivos", PNG, { filename: "foto.png", contentType: "image/png" });
    expect(subida.status).toBe(201);
    const evidencia = subida.body.evidencias[0];
    expect(evidencia).toMatchObject({ nombreArchivo: "foto.png", tipoMime: "image/png", descripcion: "Jornada en la plazoleta" });
    expect(fs.existsSync(path.join(DIR_EVIDENCIAS, evidencia.ruta))).toBe(true);

    const archivo = await api("get", `/evidencias/${evidencia.id}/archivo`).buffer(true).parse(binario);
    expect(archivo.status).toBe(200);
    expect(archivo.headers["content-type"]).toBe("image/png");
    expect(Buffer.compare(archivo.body, PNG)).toBe(0);

    const texto = await api("post", `/actividades/${actividad.id}/evidencias`).attach("archivos", Buffer.from("hola"), {
      filename: "nota.txt",
      contentType: "text/plain",
    });
    expect(texto.status).toBe(400);

    expect((await api("delete", `/evidencias/${evidencia.id}`)).status).toBe(200);
    expect(fs.existsSync(path.join(DIR_EVIDENCIAS, evidencia.ruta))).toBe(false);
  });
});

async function libroDe(res) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(res.body);
  return libro;
}

describe("Salud integral: reportes", () => {
  async function sembrar() {
    await crearPersona();
    await crearPersona({ numeroDocumento: "34569970", codigoEstudiantil: null, nombres: "Paola", apellidos: "Díaz", poblacion: "Administrativo", programa: null });
    await crearPersona({ numeroDocumento: "76000111", codigoEstudiantil: null, nombres: "Luis", apellidos: "Mora", poblacion: "Docente", programa: "Derecho" });
    const basica = await crearActividad({ nombre: "Atención básica", categoria: "AtencionEnfermeria", permanente: true, clinica: true, responsableDocumento: "1063814626", horasDedicacion: 87 });
    const tamizaje = await crearActividad();
    for (const doc of ["1061731427", "34569970", "76000111"]) {
      await api("post", "/atenciones").send({ identificador: doc, actividadId: basica.id, tensionArterial: "110/70" });
    }
    await api("post", "/atenciones").send({ identificador: "1061731427", actividadId: tamizaje.id });
    await api("post", `/actividades/${tamizaje.id}/evidencias`).attach("archivos", PNG, { filename: "f.png", contentType: "image/png" });
    return { basica, tamizaje };
  }

  test("resumen del panel", async () => {
    await sembrar();
    const res = await api("get", "/resumen");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ hoy: 4, totalPeriodo: 4, personasPeriodo: 3 });
    expect(res.body.porPoblacion.find((p) => p.nombre === "Estudiante").total).toBe(2);
    expect(res.body.ultimas).toHaveLength(4);
  });

  test("SNIES: actividades, beneficiarios por tipo (1 estudiantes, 3 docentes, 4 administrativos) y recurso humano", async () => {
    await sembrar();
    const res = await api("get", "/reportes/snies").buffer(true).parse(binario);
    expect(res.status).toBe(200);
    expect(res.headers["x-actividades-sin-responsable"]).toBe("1");
    const libro = await libroDe(res);
    expect(libro.worksheets.map((h) => h.name)).toEqual(["ACTIVIDAD_BIENESTAR", "ACT_BIENESTAR_BENEFICIARIOS", "ACT_BIENESTAR_REC_HUMANO", "INFO"]);
    const act = libro.getWorksheet("ACTIVIDAD_BIENESTAR");
    expect(act.getRow(2).getCell(5).value).toBe("ATENCIÓN BÁSICA");
    expect(act.getRow(2).getCell(3).value).toBe("BIENESTAR UNIVERSITARIO");
    const ben = libro.getWorksheet("ACT_BIENESTAR_BENEFICIARIOS");
    const filas = [];
    ben.eachRow((r, n) => n > 1 && filas.push([r.getCell(4).value, r.getCell(5).value, r.getCell(6).value]));
    expect(filas).toEqual([
      [1, 1, 1],
      [1, 3, 1],
      [1, 4, 1],
      [2, 1, 1],
    ]);
    const rh = libro.getWorksheet("ACT_BIENESTAR_REC_HUMANO");
    expect(rh.getRow(2).getCell(6).value).toBe("1063814626");
    expect(rh.getRow(2).getCell(7).value).toBe(87);
  });

  test("informe de gestion: matriz de atendidos, estadisticas y registro fotografico", async () => {
    await sembrar();
    const res = await api("get", "/reportes/gestion").buffer(true).parse(binario);
    expect(res.status).toBe(200);
    const libro = await libroDe(res);
    expect(libro.worksheets.map((h) => h.name)).toEqual(["ATENDIDOS", "ESTADÍSTICAS", "REGISTRO FOTOGRÁFICO"]);
    const hoja = libro.getWorksheet("ATENDIDOS");
    const fila = hoja.getRow(4);
    expect(fila.getCell(5).value).toBe("Atención básica");
    // Administrativo, Docente y un estudiante de Ingenieria de Software.
    expect(fila.getCell(7).value).toBe(1);
    expect(fila.getCell(8).value).toBe(1);
    const titulos = hoja.getRow(3).values;
    const colTotal = titulos.findIndex((v) => v === "Sin programa registrado") + 1;
    expect(fila.getCell(colTotal).value).toBe(3);
    expect(libro.getWorksheet("REGISTRO FOTOGRÁFICO").getImages()).toHaveLength(1);
  });

  test("registro general en formato SPADIEZ con hoja de enfermeria", async () => {
    await sembrar();
    const res = await api("get", "/reportes/registro").buffer(true).parse(binario);
    const libro = await libroDe(res);
    const general = libro.getWorksheet("REGISTRO GENERAL");
    expect(general.rowCount).toBe(5);
    const cargos = [];
    general.eachRow((r, n) => n > 1 && cargos.push(r.getCell(7).value));
    expect(cargos).toEqual(expect.arrayContaining(["ADMINISTRATIVO", "DOCENTE DERECHO - GOBIERNO Y RELACIONES INTERNACIONALES", "INGENIERÍA DE SOFTWARE Y COMPUTACIÓN"]));
    expect(libro.getWorksheet("ATENCIÓN ENFERMERÍA").rowCount).toBe(4);
  });
});

describe("Salud integral: importador de Excel", () => {
  async function excelRegistro(filas) {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet("JULIO 2026");
    hoja.addRow(["APELLIDOS", "NOMBRES", "TIPO DE DOCUMENTO", "Nº DE DOCUMENTO", "TELEFONO", "CARGO", "FECHA", "TIPO DE ACTIVIDAD", "MEDICO LABORAL", "TIPO DE INSUMO"]);
    filas.forEach((f) => hoja.addRow(f));
    return Buffer.from(await libro.xlsx.writeBuffer());
  }

  test("vista previa, importacion y re-importacion sin duplicados", async () => {
    const f = hoy().split("-").reverse().join("/");
    const buffer = await excelRegistro([
      ["PEREZ GOMEZ", "ANA MARIA", "CEDULA DE CIUDADANIA", 1061000001, 3001112233, "ADMINISTRATIVO", f, "ATENCION MEDICA", "INGRESO", null],
      ["PEREZ GOMEZ", "ANA MARIA", "CEDULA DE CIUDADANIA", "1061000001.0", null, "ADMINISTRATIVO", f, "ATENCION BASICA", null, "1 TAPABOCAS"],
      ["RUIZ", "CARLOS", "TARJETA DE IDENTIDAD", 1002003004, null, "DOCENTE DERECHO", f, "FERIA DE LA SALUD", null, null],
      ["SIN", "DOCUMENTO", "CEDULA DE CIUDADANIA", null, null, "DERECHO", f, "TAMIZAJE CORPORAL", null, null],
    ]);
    const previa = await api("post", "/importar").attach("archivo", buffer, "spadiez.xlsx");
    expect(previa.status).toBe(200);
    expect(previa.body).toMatchObject({ confirmado: false, atenciones: 3, personasNuevas: 2, filasOmitidas: 1 });
    expect(previa.body.formato).toMatch(/SPADIEZ/);
    expect(prisma.__saludTablas.personas).toHaveLength(0);

    const hecha = await api("post", "/importar?confirmar=true").attach("archivo", buffer, "spadiez.xlsx");
    expect(hecha.status).toBe(201);
    expect(hecha.body).toMatchObject({ confirmado: true, importadas: 3 });
    const ana = prisma.__saludTablas.personas.find((p) => p.numeroDocumento === "1061000001");
    expect(ana).toMatchObject({ nombres: "Ana Maria", apellidos: "Perez Gomez", poblacion: "Administrativo", consentimientoDatos: false });
    const carlos = prisma.__saludTablas.personas.find((p) => p.numeroDocumento === "1002003004");
    expect(carlos).toMatchObject({ tipoDocumento: "TI", poblacion: "Docente", programa: "Derecho - Gobierno y Relaciones Internacionales" });
    const medica = prisma.__saludTablas.atenciones.find((a) => a.examenLaboral === "Ingreso");
    expect(medica.origen).toBe("importado");

    const otra = await api("post", "/importar?confirmar=true").attach("archivo", buffer, "spadiez.xlsx");
    expect(otra.body).toMatchObject({ importadas: 0, duplicadasOmitidas: 3, personasNuevas: 0 });

    // Ya se puede registrar a Ana solo con su cedula.
    const actividad = prisma.__saludTablas.actividades.find((a) => a.nombre === "Atención básica");
    const reg = await api("post", "/atenciones").send({ identificador: "1061000001", actividadId: actividad.id, permitirRepetida: true, consentimientoDatos: true });
    expect(reg.status).toBe(201);
  });

  test("formulario de enfermeria: signos vitales, peso/talla y autorizacion", async () => {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet("Sheet1");
    hoja.addRow(["Id", "Correo electrónico", "En cumplimiento de la Ley 1581 de 2012 y", "APELLIDO", "NOMBRE1", "TIPO DE DOCUMENTO ", "DOCUMENTO DE IDENTIFICACION", "TELEFONO", "PROGRAMA", "FECHA DE LA ATENCION ", "TIPO DE ATENCION ", "TIPO DE INSUMO\n", "TENSION ARTERIAL ", "FRECUENCIA CARDIACA", "FRECUENCIA RESPIRATORIA", "PESO / TALLA ", "GLUCOMETRIA ( SOLO SI ESTA ES NECESARIA ", "DESCRIPCION BREVE DEL EVENTO "]);
    hoja.addRow([1, "anonymous", "SI", "Navia Gómez ", "Kevin Stiven ", "CEDULA DE CIUDADANIA", "1002975763", "3147713337", "Entrenamiento Deportivo (Deporte y Actividad Física)", hoyBogota(), "ATENCION BASICA", "Gasas ", "120/80", "72", "19", "65/178", "Na ", "Caída en cancha"]);
    hoja.addRow([2, "anonymous", "SI", "Paz", "Lina", "CEDULA DE CIUDADANIA", "1002975764", "3000000000", "Derecho", hoyBogota(), "REMISION EPS", "Na", "110/70", "80", "18", "55/1.60", "Na", "Remitida a EPS"]);
    const buffer = Buffer.from(await libro.xlsx.writeBuffer());
    const res = await api("post", "/importar?confirmar=true").attach("archivo", buffer, "enfermeria.xlsx");
    expect(res.status).toBe(201);
    expect(res.body.formato).toMatch(/enfermería/);
    const kevin = prisma.__saludTablas.personas.find((p) => p.numeroDocumento === "1002975763");
    expect(kevin).toMatchObject({ nombres: "Kevin Stiven", consentimientoDatos: true, programa: "Entrenamiento Deportivo" });
    const atencion = prisma.__saludTablas.atenciones.find((a) => a.personaId === kevin.id);
    expect(atencion).toMatchObject({ tensionArterial: "120/80", frecuenciaCardiaca: 72, pesoKg: 65, tallaCm: 178, insumo: "Gasas", glucometria: null });
    const lina = prisma.__saludTablas.atenciones.find((a) => a.remitido);
    expect(lina.tallaCm).toBe(160);
  });

  test("rechaza archivos que no reconoce", async () => {
    const libro = new ExcelJS.Workbook();
    libro.addWorksheet("x").addRow(["A", "B"]);
    const res = await api("post", "/importar").attach("archivo", Buffer.from(await libro.xlsx.writeBuffer()), "otro.xlsx");
    expect(res.status).toBe(400);
  });
});

describe("Citas por modulo (Desarrollo humano y Salud)", () => {
  function horarioSalud(dias = 3) {
    const servicio = prisma.__seedServicio({ nombre: "Consulta de enfermería", modulo: "salud" });
    return { servicio, horario: prisma.__seedHorario({ servicioId: servicio.id, fecha: diasDesdeHoy(dias), horaInicio: new Date(Date.UTC(1970, 0, 1, 9)), horaFin: new Date(Date.UTC(1970, 0, 1, 9, 30)) }) };
  }

  test("cada modulo ve sus servicios y horarios", async () => {
    const { servicio } = horarioSalud();
    const est = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const dh = await request(app).get("/api/v1/servicios").set(auth(est.token));
    expect(dh.body.servicios.map((s) => s.id)).toEqual(["servicio-1"]);
    const sal = await request(app).get("/api/v1/servicios?modulo=salud").set(auth(est.token));
    expect(sal.body.servicios.map((s) => s.id)).toEqual([servicio.id]);
    const horarios = await request(app).get("/api/v1/citas/horarios-disponibles?modulo=salud").set(auth(est.token));
    expect(horarios.body.horarios).toHaveLength(1);

    const comoSalud = await request(app).get("/api/v1/admin/horarios").set(auth(salud.token));
    expect(comoSalud.body.horarios.every((h) => h.servicio.modulo === "salud")).toBe(true);
    const admin = crearUsuario("Administrador", "a@uniautonoma.edu.co");
    const comoAdmin = await request(app).get("/api/v1/admin/horarios").set(auth(admin.token));
    expect(comoAdmin.body.horarios).toHaveLength(0);
  });

  test("el administrador no gestiona horarios de Salud y viceversa", async () => {
    const { servicio } = horarioSalud();
    const admin = crearUsuario("Administrador", "a@uniautonoma.edu.co");
    const datos = { servicioId: servicio.id, fecha: diasDesdeHoy(6).toISOString().slice(0, 10), horaInicio: "10:00", horaFin: "10:30" };
    expect((await request(app).post("/api/v1/admin/horarios").set(auth(admin.token)).send(datos)).status).toBe(403);
    expect((await request(app).post("/api/v1/admin/horarios").set(auth(salud.token)).send(datos)).status).toBe(201);
    const dh = { ...datos, servicioId: "servicio-1" };
    expect((await request(app).post("/api/v1/admin/horarios").set(auth(salud.token)).send(dh)).status).toBe(403);
  });

  test("RN-004 por modulo: una cita de orientacion y una de salud a la vez", async () => {
    const est = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const dh = prisma.__seedHorario({ fecha: diasDesdeHoy(3), horaInicio: new Date(Date.UTC(1970, 0, 1, 8)), horaFin: new Date(Date.UTC(1970, 0, 1, 9)) });
    const { horario } = horarioSalud();
    const { horario: otro } = horarioSalud(4);
    expect((await request(app).post("/api/v1/citas").set(auth(est.token)).send({ horarioId: dh.id })).status).toBe(201);
    expect((await request(app).post("/api/v1/citas").set(auth(est.token)).send({ horarioId: horario.id })).status).toBe(201);
    expect((await request(app).post("/api/v1/citas").set(auth(est.token)).send({ horarioId: otro.id })).status).toBe(409);

    // La agenda de Salud solo muestra citas de Salud.
    const agenda = await request(app).get("/api/v1/admin/citas").set(auth(salud.token));
    expect(agenda.body.citas).toHaveLength(1);
    expect(agenda.body.citas[0].horario.servicio.modulo).toBe("salud");
  });

  test("el estudiante ve sus participaciones (sin datos clinicos)", async () => {
    const est = crearUsuario("Estudiante", "kathe@uniautonoma.edu.co");
    await crearPersona({ correo: "Kathe@uniautonoma.edu.co" });
    const actividad = await crearActividad({ nombre: "Atención básica", clinica: true, permanente: true, categoria: "AtencionEnfermeria" });
    await api("post", "/atenciones").send({ identificador: "1061731427", actividadId: actividad.id, descripcion: "Dato clínico" });
    const res = await request(app).get("/api/v1/salud/estudiante/mis-participaciones").set(auth(est.token));
    expect(res.status).toBe(200);
    expect(res.body.vinculado).toBe(true);
    expect(res.body.participaciones[0]).toEqual(expect.objectContaining({ actividad: "Atención básica" }));
    expect(JSON.stringify(res.body)).not.toContain("Dato clínico");
  });
});

afterAll(() => fs.rmSync(DIR_EVIDENCIAS, { recursive: true, force: true }));
