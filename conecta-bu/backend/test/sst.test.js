// Pruebas de salidas institucionales y reportes SST (reemplazan el
// formulario de Google "0 SALUD INTEGRAL"): validacion por tipo, documentos
// obligatorios segun el transporte, anticipacion, privacidad y revision.

const os = require("os");
const path = require("path");
const fs = require("fs");

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const { configurarEntorno, crearUsuario, diasDesdeHoy, auth } = require("./helpers");
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "cbu-sst-"));
configurarEntorno({ SALUD_UPLOADS_DIR: DIR });

const request = require("supertest");
const ExcelJS = require("exceljs");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
const binario = (res, cb) => {
  const partes = [];
  res.on("data", (d) => partes.push(d));
  res.on("end", () => cb(null, Buffer.concat(partes)));
};

let docente;
let otro;
let salud;
let orientacion;
beforeEach(() => {
  prisma.__reset();
  docente = crearUsuario("Estudiante", "docente.viajero@uniautonoma.edu.co", "Docente Viajero");
  otro = crearUsuario("Estudiante", "otra.persona@uniautonoma.edu.co");
  salud = crearUsuario("Salud", "sst@uniautonoma.edu.co");
  orientacion = crearUsuario("Administrador", "psicologia@uniautonoma.edu.co");
});

const base = (extra = {}) => ({
  consentimientoDatos: true,
  celular: "3104567890",
  area: "Ingeniería Civil",
  ...extra,
});

const salidaLocal = (extra = {}) =>
  base({
    tipo: "SalidaEstudiantesLocal",
    evento: "Visita técnica a la planta de tratamiento",
    destino: "PTAR Popayán",
    fechaSalida: diasDesdeHoy(4),
    fechaRegreso: diasDesdeHoy(4),
    horaSalida: "7:30",
    horaRegreso: "13:00",
    numeroEstudiantes: 28,
    responsableNombre: "Docente Viajero",
    responsableTipoDoc: "CC",
    responsableDocumento: "1.061.700.111",
    medioTransporte: "Institucional",
    conductor: "Pedro Pérez",
    placa: "abc 123",
    ...extra,
  });

function enviar(datos, archivos = {}, token = docente.token) {
  const req = request(app).post("/api/v1/reportes-sst").set(auth(token)).field("datos", JSON.stringify(datos));
  for (const [tipo, n] of Object.entries(archivos)) {
    for (let i = 0; i < n; i++) req.attach(tipo, PDF, { filename: `${tipo}-${i}.pdf`, contentType: "application/pdf" });
  }
  return req;
}

describe("Reportar una salida (cualquier persona de la Institución)", () => {
  it("entrega el catálogo con los tipos del formulario", async () => {
    const res = await request(app).get("/api/v1/reportes-sst/catalogos").set(auth(docente.token));
    expect(res.status).toBe(200);
    expect(res.body.tipos.map((t) => t.id)).toEqual(
      expect.arrayContaining(["SalidaEstudiantesLocal", "RepresentacionInternacional", "TrasladoPosgrados", "CondicionInsegura"])
    );
    expect(res.body.areas).toContain("Posgrados");
    expect(res.body.tipos.find((t) => t.id === "SalidaEstudiantesLocal").adjuntosBase).toEqual(["Poliza"]);
  });

  it("exige iniciar sesión", async () => {
    const res = await request(app).get("/api/v1/reportes-sst/mios");
    expect(res.status).toBe(401);
  });

  it("registra una salida con estudiantes con la póliza y limpia los datos", async () => {
    const res = await enviar(salidaLocal(), { Poliza: 1 });
    expect(res.status).toBe(201);
    const r = res.body.reporte;
    expect(r.codigo).toBe("SST-0001");
    expect(r.estado).toBe("Recibido");
    expect(r.horaSalida).toBe("07:30");
    expect(r.placa).toBe("ABC123");
    // Quien reporta ve la cedula enmascarada; el personal de Salud, completa.
    expect(r.responsableDocumento).toBe("****0111");
    const paraSalud = await request(app).get(`/api/v1/reportes-sst/${r.id}`).set(auth(salud.token));
    expect(paraSalud.body.reporte.responsableDocumento).toBe("1061700111");
    expect(r.correo).toBe("docente.viajero@uniautonoma.edu.co");
    expect(r.nombreReporta).toBe("Docente Viajero");
    expect(r.adjuntos).toHaveLength(1);
    expect(r.adjuntos[0].ruta).toBeUndefined();
    expect(r.adjuntosFaltantes).toEqual([]);
  });

  it("no acepta la salida con estudiantes sin la póliza estudiantil", async () => {
    const res = await enviar(salidaLocal());
    expect(res.status).toBe(400);
    expect(res.body.codigo || res.body.code).toBeDefined();
    expect(res.body.message).toMatch(/póliza/i);
    expect(prisma.__saludTablas.reportesSst).toHaveLength(0);
  });

  it("pide licencia, tarjeta de propiedad, técnico-mecánica y SOAT en vehículo particular", async () => {
    const datos = salidaLocal({ medioTransporte: "Particular", conductor: undefined, placa: undefined });
    const incompleto = await enviar(datos, { Poliza: 1, Licencia: 1, Soat: 1 });
    expect(incompleto.status).toBe(400);
    expect(incompleto.body.message).toMatch(/tarjeta de propiedad/i);
    expect(incompleto.body.message).toMatch(/técnico-mecánica/i);
    const completo = await enviar(datos, { Poliza: 1, Licencia: 1, Soat: 1, TarjetaPropiedad: 1, Tecnomecanica: 1 });
    expect(completo.status).toBe(201);
    expect(completo.body.reporte.adjuntos).toHaveLength(5);
  });

  it("pide la empresa en transporte público y el conductor y la placa en el institucional", async () => {
    const publico = await enviar(salidaLocal({ medioTransporte: "Publico" }), { Poliza: 1 });
    expect(publico.status).toBe(400);
    expect(publico.body.message).toMatch(/empresa/i);
    const sinPlaca = await enviar(salidaLocal({ placa: "" }), { Poliza: 1 });
    expect(sinPlaca.status).toBe(400);
    expect(sinPlaca.body.message).toMatch(/placa/i);
  });

  it("solo permite los medios de transporte de cada tipo (regional no tiene aéreo)", async () => {
    const res = await enviar(salidaLocal({ tipo: "SalidaEstudiantesRegional", medioTransporte: "Aereo" }), { Poliza: 1, Vuelo: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/medio de transporte/i);
  });

  it("rechaza documentos que no aplican al reporte", async () => {
    const res = await enviar(salidaLocal(), { Poliza: 1, Soat: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no aplica/i);
  });

  it("exige la autorización de datos (Ley 1581)", async () => {
    const res = await enviar(salidaLocal({ consentimientoDatos: false }), { Poliza: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/1581/);
  });

  it("valida fechas: el regreso no puede ser antes de la salida", async () => {
    const res = await enviar(salidaLocal({ fechaRegreso: diasDesdeHoy(2) }), { Poliza: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/regreso/i);
  });

  it("marca fuera de tiempo una salida internacional reportada con menos de 5 días", async () => {
    const datos = base({
      tipo: "RepresentacionInternacional",
      responsableNombre: "Docente Viajero",
      responsableTipoDoc: "CC",
      responsableDocumento: "1061700111",
      evento: "Congreso latinoamericano de ingeniería",
      pais: "México",
      destino: "Ciudad de México",
      fechaSalida: diasDesdeHoy(3),
      fechaRegreso: diasDesdeHoy(8),
      horaSalida: "05:00",
      horaRegreso: "22:00",
      medioTransporte: "Publico",
      transporteEmpresa: "Taxi Libre",
      acompanantes: [{ nombre: "Ana Gómez", documento: "34.555.666" }],
    });
    const sinMovilidad = await enviar(datos);
    expect(sinMovilidad.status).toBe(400);
    expect(sinMovilidad.body.message).toMatch(/movilidad/i);
    const res = await enviar(datos, { Movilidad: 1 });
    expect(res.status).toBe(201);
    expect(res.body.reporte.diasAnticipacion).toBe(3);
    expect(res.body.reporte.fueraDeTiempo).toBe(true);
    expect(res.body.reporte.gestion).toBe("ASIST CARD");
    expect(res.body.reporte.acompanantes).toEqual([{ nombre: "Ana Gómez", documento: "****5666" }]);

    const aTiempo = await enviar({ ...datos, fechaSalida: diasDesdeHoy(6) }, { Movilidad: 1 });
    expect(aTiempo.body.reporte.fueraDeTiempo).toBe(false);
  });

  it("registra un traslado de posgrados en avión con la información del vuelo", async () => {
    const res = await enviar(
      base({
        tipo: "TrasladoPosgrados",
        area: "Posgrados",
        responsableNombre: "Docente Invitado",
        responsableTipoDoc: "CC",
        responsableDocumento: "79111222",
        motivo: "Clases de la especialización en gerencia",
        ciudadOrigen: "Bogotá",
        destino: "Popayán, Cauca",
        lugarDestino: "Sede principal",
        fechaSalida: diasDesdeHoy(5),
        fechaRegreso: diasDesdeHoy(7),
        horaSalida: "06:00",
        horaRegreso: "19:00",
        medioTransporte: "Aereo",
      }),
      { Vuelo: 1, Listado: 1 }
    );
    expect(res.status).toBe(201);
    expect(res.body.reporte.fueraDeTiempo).toBe(false);
  });

  it("registra una condición insegura con evidencias opcionales", async () => {
    const datos = base({
      tipo: "CondicionInsegura",
      lugarEvento: "Escaleras del bloque B",
      fechaEvento: diasDesdeHoy(0),
      horaEvento: "10:15",
      afectado: "Docente Viajero",
      cargo: "Docente",
      descripcion: "Baranda suelta en el segundo piso.",
      clasificacion: "CondicionInsegura",
      potencial: "Alto",
      medidaControl: "Señalizar y reparar la baranda.",
    });
    const futura = await enviar({ ...datos, fechaEvento: diasDesdeHoy(2) });
    expect(futura.status).toBe(400);
    const res = await request(app)
      .post("/api/v1/reportes-sst")
      .set(auth(docente.token))
      .field("datos", JSON.stringify(datos))
      .attach("Evidencia", Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"), {
        filename: "baranda.png",
        contentType: "image/png",
      });
    expect(res.status).toBe(201);
    expect(res.body.reporte.potencial).toBe("Alto");
    expect(res.body.reporte.adjuntos[0].tipo).toBe("Evidencia");
  });

  it("solo muestra a cada persona sus propios reportes y documentos", async () => {
    const creado = (await enviar(salidaLocal(), { Poliza: 1 })).body.reporte;
    const mios = await request(app).get("/api/v1/reportes-sst/mios").set(auth(otro.token));
    expect(mios.body.reportes).toHaveLength(0);
    const ajeno = await request(app).get(`/api/v1/reportes-sst/${creado.id}`).set(auth(otro.token));
    expect(ajeno.status).toBe(404);
    const archivoAjeno = await request(app).get(`/api/v1/reportes-sst/adjuntos/${creado.adjuntos[0].id}/archivo`).set(auth(otro.token));
    expect(archivoAjeno.status).toBe(404);
    const propio = await request(app).get(`/api/v1/reportes-sst/adjuntos/${creado.adjuntos[0].id}/archivo`).set(auth(docente.token));
    expect(propio.status).toBe(200);
    expect(propio.headers["content-type"]).toMatch(/pdf/);
  });
});

describe("Sugerencias de personas al escribir el nombre de quien viaja", () => {
  const buscar = (q, token = docente.token) => request(app).get(`/api/v1/reportes-sst/personas?q=${encodeURIComponent(q)}`).set(auth(token));

  beforeEach(async () => {
    await prisma.personaSalud.create({ data: { numeroDocumento: "10541234", nombres: "JORGE IVÁN", apellidos: "PAZ MUÑOZ", poblacion: "Docente" } });
    await prisma.personaSalud.create({ data: { numeroDocumento: "34567123", nombres: "Diana", apellidos: "Ruiz", poblacion: "Administrativo", tipoDocumento: "CE" } });
    // Los estudiantes registrados en Salud no se sugieren (datos de salud).
    await prisma.personaSalud.create({ data: { numeroDocumento: "1061999888", nombres: "Jorge", apellidos: "Estudiante", poblacion: "Estudiante" } });
  });

  it("sugiere docentes y administrativos con la cédula enmascarada, sin datos de salud", async () => {
    const res = await buscar("jorge paz");
    expect(res.status).toBe(200);
    expect(res.body.personas).toEqual([{ nombre: "Jorge Iván Paz Muñoz", tipoDocumento: "CC", documento: "****1234", documentoRef: expect.any(String), detalle: "Docente" }]);
    expect(JSON.stringify(res.body)).not.toContain("10541234");
    expect((await buscar("jo")).body.personas).toEqual([]);
    // Sin tildes ni mayusculas tambien encuentra.
    expect((await buscar("ivan munoz")).body.personas[0].documento).toBe("****1234");
  });

  it("no busca por número de cédula", async () => {
    expect((await buscar("3456")).body.personas).toEqual([]);
    expect((await buscar("10541234")).body.personas).toEqual([]);
  });

  it("al guardar, la sugerencia elegida queda con la cédula real", async () => {
    const [jorge] = (await buscar("jorge paz")).body.personas;
    const res = await enviar(
      salidaLocal({
        responsableNombre: jorge.nombre,
        responsableDocumento: jorge.documento,
        responsableDocumentoRef: jorge.documentoRef,
        acompanantes: [{ nombre: jorge.nombre, documento: jorge.documento, documentoRef: jorge.documentoRef }],
      }),
      { Poliza: 1 }
    );
    expect(res.status).toBe(201);
    const guardado = prisma.__saludTablas.reportesSst[0];
    expect(guardado.responsableDocumento).toBe("10541234");
    expect(guardado.acompanantes).toEqual([{ nombre: jorge.nombre, documento: "10541234" }]);
    expect(guardado.responsableDocumentoRef).toBeUndefined();
    // Quien reporta no recupera la cedula completa al ver su reporte.
    expect(res.body.reporte.responsableDocumento).toBe("****1234");
  });

  it("rechaza una cédula enmascarada sin referencia válida", async () => {
    const res = await enviar(salidaLocal({ responsableDocumento: "****1234", responsableDocumentoRef: "referencia-falsa" }), { Poliza: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/documento/i);
  });

  it("también sugiere a quienes ya viajaron en reportes anteriores", async () => {
    await enviar(salidaLocal({ acompanantes: [{ nombre: "Camilo Andrés Ortega", documento: "76.111.222" }] }), { Poliza: 1 });
    const res = await buscar("ortega", otro.token);
    expect(res.body.personas).toEqual([{ nombre: "Camilo Andrés Ortega", tipoDocumento: "CC", documento: "****1222", documentoRef: expect.any(String), detalle: "Reporte anterior" }]);
  });

  it("exige iniciar sesión", async () => {
    expect((await request(app).get("/api/v1/reportes-sst/personas?q=jorge")).status).toBe(401);
  });
});

describe("Revisión del personal de Salud", () => {
  const panel = (metodo, ruta, token = salud.token) => request(app)[metodo](`/api/v1/salud/reportes-sst${ruta}`).set(auth(token));

  it("la bandeja es solo para el personal con acceso a Salud", async () => {
    expect((await panel("get", "/", docente.token)).status).toBe(403);
    expect((await panel("get", "/", orientacion.token)).status).toBe(403);
    expect((await panel("get", "/")).status).toBe(200);
  });

  it("lista, filtra y cuenta por estado", async () => {
    await enviar(salidaLocal(), { Poliza: 1 });
    await enviar(salidaLocal({ evento: "Salida de campo a Silvia", destino: "Silvia" }), { Poliza: 1 }, otro.token);
    const todos = await panel("get", "/");
    expect(todos.body.reportes).toHaveLength(2);
    expect(todos.body.conteos.Recibido).toBe(2);
    const buscados = await panel("get", "/?q=silvia");
    expect(buscados.body.reportes).toHaveLength(1);
    const grupo = await panel("get", "/?grupo=riesgo");
    expect(grupo.body.reportes).toHaveLength(0);
    const rango = await panel("get", `/?desde=${diasDesdeHoy(10).toISOString().slice(0, 10)}`);
    expect(rango.body.reportes).toHaveLength(0);
  });

  it("pide ajustes, la persona adjunta y vuelve a la bandeja; luego se verifica y se marca la ARL", async () => {
    const creado = (await enviar(salidaLocal(), { Poliza: 1 })).body.reporte;
    const sinMotivo = await panel("patch", `/${creado.id}`).send({ estado: "RequiereAjustes" });
    expect(sinMotivo.status).toBe(400);
    const ajustes = await panel("patch", `/${creado.id}`).send({ estado: "RequiereAjustes", observacion: "La póliza está vencida." });
    expect(ajustes.status).toBe(200);
    expect(ajustes.body.reporte.revisadoPor).toBe("sst@uniautonoma.edu.co");

    const adjunta = await request(app)
      .post(`/api/v1/reportes-sst/${creado.id}/adjuntos`)
      .set(auth(docente.token))
      .attach("Poliza", PDF, { filename: "poliza-nueva.pdf", contentType: "application/pdf" });
    expect(adjunta.status).toBe(201);
    expect(adjunta.body.reporte.estado).toBe("Recibido");
    expect(adjunta.body.reporte.adjuntos).toHaveLength(2);

    const verificado = await panel("patch", `/${creado.id}`).send({ estado: "Verificado", gestionExterna: true });
    expect(verificado.body.reporte.estado).toBe("Verificado");
    expect(verificado.body.reporte.gestionExterna).toBe(true);

    const tarde = await request(app)
      .post(`/api/v1/reportes-sst/${creado.id}/adjuntos`)
      .set(auth(docente.token))
      .attach("Listado", PDF, { filename: "lista.pdf", contentType: "application/pdf" });
    expect(tarde.status).toBe(409);
  });

  it("no deja verificar una salida a la que le faltan documentos", async () => {
    const creado = (await enviar(salidaLocal(), { Poliza: 1 })).body.reporte;
    // Simula un registro antiguo sin la poliza.
    prisma.__saludTablas.adjuntosSst.length = 0;
    const res = await panel("patch", `/${creado.id}`).send({ estado: "Verificado" });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/póliza/i);
  });

  it("resume pendientes y próximas salidas", async () => {
    await enviar(salidaLocal(), { Poliza: 1 });
    const res = await panel("get", "/resumen");
    expect(res.body.pendientes).toBe(1);
    expect(res.body.proximas).toHaveLength(1);
    expect(res.body.proximas[0].codigo).toBe("SST-0001");
  });

  it("el personal ve el detalle y los documentos de cualquier reporte", async () => {
    const creado = (await enviar(salidaLocal(), { Poliza: 1 })).body.reporte;
    expect((await request(app).get(`/api/v1/reportes-sst/${creado.id}`).set(auth(salud.token))).status).toBe(200);
    expect((await request(app).get(`/api/v1/reportes-sst/adjuntos/${creado.adjuntos[0].id}/archivo`).set(auth(salud.token))).status).toBe(200);
  });

  it("exporta el consolidado en Excel con resumen, salidas y condiciones inseguras", async () => {
    await enviar(salidaLocal(), { Poliza: 1 });
    const res = await panel("get", "/exportar").buffer(true).parse(binario);
    expect(res.status).toBe(200);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(res.body);
    expect(libro.worksheets.map((h) => h.name)).toEqual(["RESUMEN", "SALIDAS", "CONDICIONES INSEGURAS"]);
    const salidas = libro.getWorksheet("SALIDAS");
    expect(salidas.getCell(4, 1).value).toBe("SST-0001");
    expect(salidas.getCell(4, 6).value).toMatch(/Visita técnica/);
  });
});
