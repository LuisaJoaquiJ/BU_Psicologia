const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");
const { periodoDeFecha, rangoDePeriodo } = require("../utils/catalogos");
const { FORMATOS, actividadDestino, claveNombre } = require("../utils/importacion/formatos");
const { leerLibro, extraerRegistros } = require("../utils/importacion/lectura");

// Importa los Excel que hoy lleva la Unidad de Salud (registro general y
// formulario de enfermeria) para arrancar con las personas y su historial.
// Primero se muestra una vista previa; solo con confirmar=true se guarda.
class ImportadorService {
  constructor(r = repos) {
    this.repos = r;
  }

  // Personas del Excel: la ultima fila de cada documento trae los datos mas recientes.
  personasDelExcel(registros) {
    const personas = new Map();
    for (const r of registros) {
      const previa = personas.get(r.persona.numeroDocumento);
      personas.set(r.persona.numeroDocumento, {
        ...previa,
        ...Object.fromEntries(Object.entries(r.persona).filter(([, v]) => v !== null && v !== false)),
        consentimiento: Boolean(previa?.consentimiento || r.persona.consentimiento),
      });
    }
    return personas;
  }

  // Actividades del catalogo por periodo y nombre, y las que faltan crear.
  async actividadesDe(registros) {
    const periodos = [...new Set(registros.map((r) => periodoDeFecha(r.fecha)))].sort();
    const catalogo = new Map((await this.repos.actividades.deLosPeriodos(periodos)).map((a) => [`${a.periodo}|${claveNombre(a.nombre)}`, a]));
    const nuevas = new Map();
    for (const r of registros) {
      const destino = actividadDestino(r.actividadTexto);
      const periodo = periodoDeFecha(r.fecha);
      const clave = `${periodo}|${claveNombre(destino.nombre)}`;
      r.claveActividad = clave;
      if (!catalogo.has(clave) && !nuevas.has(clave)) nuevas.set(clave, { ...destino, periodo, fechas: [] });
      if (nuevas.has(clave)) nuevas.get(clave).fechas.push(r.fecha);
    }
    return { periodos, catalogo, nuevas };
  }

  async importar(buffer, { confirmar = false } = {}, usuarioId) {
    const lectura = await leerLibro(buffer);
    const { registros, advertencias, fechasCorregidas } = extraerRegistros(lectura);
    if (!registros.length) throw new AppError(400, "El archivo no tiene filas válidas para importar.");

    const personasExcel = this.personasDelExcel(registros);
    const documentos = [...personasExcel.keys()];
    const existentes = await this.repos.personas.porDocumentos(documentos);
    const yaEstan = new Set(existentes.map((p) => p.numeroDocumento));
    const { periodos, catalogo, nuevas } = await this.actividadesDe(registros);

    const vistaPrevia = {
      formato: FORMATOS[lectura.formato].nombre,
      hoja: lectura.hoja.name,
      filasLeidas: registros.length + advertencias.length,
      atenciones: registros.length,
      personasNuevas: documentos.filter((d) => !yaEstan.has(d)).length,
      personasExistentes: documentos.filter((d) => yaEstan.has(d)).length,
      periodos,
      actividadesNuevas: [...nuevas.values()].map((a) => ({ nombre: a.nombre, periodo: a.periodo })),
      filasOmitidas: advertencias.length,
      motivosOmision: advertencias.reduce((acc, a) => ({ ...acc, [a.motivo]: (acc[a.motivo] || 0) + 1 }), {}),
      fechasCorregidas,
      advertencias: advertencias.slice(0, 30),
    };
    if (!confirmar) return { ...vistaPrevia, confirmado: false };

    const personas = await this.guardarPersonas(personasExcel, documentos, existentes, yaEstan);
    await this.crearActividades(nuevas, catalogo);
    const { importadas, duplicadas } = await this.guardarAtenciones(registros, personas, catalogo, usuarioId);
    return { ...vistaPrevia, confirmado: true, importadas, duplicadasOmitidas: duplicadas, actividadesCreadas: nuevas.size };
  }

  // Crea las personas nuevas y completa los datos que les falten a las existentes.
  async guardarPersonas(personasExcel, documentos, existentes, yaEstan) {
    const nuevas = documentos.filter((d) => !yaEstan.has(d)).map((d) => personasExcel.get(d));
    for (let i = 0; i < nuevas.length; i += 500) {
      await this.repos.personas.crearVarias(
        nuevas.slice(i, i + 500).map((p) => ({
          numeroDocumento: p.numeroDocumento,
          tipoDocumento: p.tipoDocumento || "CC",
          nombres: p.nombres,
          apellidos: p.apellidos,
          telefono: p.telefono || null,
          correo: p.correo || null,
          poblacion: p.poblacion || "Estudiante",
          programa: p.programa || null,
          consentimientoDatos: Boolean(p.consentimiento),
          fechaConsentimiento: p.consentimiento ? new Date() : null,
        })),
      );
    }
    for (const existente of existentes) {
      const p = personasExcel.get(existente.numeroDocumento);
      const cambios = {};
      if (!existente.telefono && p.telefono) cambios.telefono = p.telefono;
      if (!existente.correo && p.correo) cambios.correo = p.correo;
      if (!existente.programa && p.programa) cambios.programa = p.programa;
      if (!existente.consentimientoDatos && p.consentimiento) Object.assign(cambios, { consentimientoDatos: true, fechaConsentimiento: new Date() });
      if (Object.keys(cambios).length) await this.repos.personas.actualizar(existente.id, cambios);
    }
    return new Map((await this.repos.personas.porDocumentos(documentos)).map((p) => [p.numeroDocumento, p]));
  }

  // Actividades que no estaban en el catalogo del periodo.
  async crearActividades(nuevas, catalogo) {
    for (const [clave, a] of nuevas) {
      const ultima = await this.repos.actividades.ultimaDelPeriodo(a.periodo);
      const rango = rangoDePeriodo(a.periodo);
      const fechas = a.fechas.map((f) => f.getTime());
      const creada = await this.repos.actividades.crear({
        codigo: (ultima?.codigo || 0) + 1,
        periodo: a.periodo,
        nombre: a.nombre,
        categoria: a.categoria,
        permanente: a.permanente,
        clinica: a.clinica,
        meta: 1,
        fechaInicio: a.permanente ? rango.desde : new Date(Math.min(...fechas)),
        fechaFin: a.permanente ? rango.hasta : new Date(Math.max(...fechas)),
      });
      catalogo.set(clave, creada);
    }
  }

  // Atenciones, sin duplicar lo ya importado (persona + actividad + fecha).
  async guardarAtenciones(registros, personas, catalogo, usuarioId) {
    const dia = (f) => new Date(f).toISOString().slice(0, 10);
    const previas = await this.repos.atenciones.claves([...personas.values()].map((p) => p.id));
    const vistas = new Set(previas.map((a) => `${a.personaId}|${a.actividadId}|${dia(a.fecha)}`));
    const nuevas = [];
    let duplicadas = 0;
    for (const r of registros) {
      const persona = personas.get(r.persona.numeroDocumento);
      const actividad = catalogo.get(r.claveActividad);
      const clave = `${persona.id}|${actividad.id}|${dia(r.fecha)}`;
      if (vistas.has(clave)) {
        duplicadas += 1;
        continue;
      }
      vistas.add(clave);
      nuevas.push({
        personaId: persona.id,
        actividadId: actividad.id,
        fecha: r.fecha,
        poblacion: persona.poblacion,
        programa: persona.programa,
        examenLaboral: r.examenLaboral,
        insumo: r.insumo,
        tensionArterial: r.tensionArterial ?? null,
        frecuenciaCardiaca: r.frecuenciaCardiaca ?? null,
        frecuenciaRespiratoria: r.frecuenciaRespiratoria ?? null,
        pesoKg: r.pesoKg ?? null,
        tallaCm: r.tallaCm ?? null,
        glucometria: r.glucometria ?? null,
        descripcion: r.descripcion ?? null,
        remitido: Boolean(r.remitido),
        origen: "importado",
        registradoPorId: usuarioId || null,
      });
    }
    for (let i = 0; i < nuevas.length; i += 1000) await this.repos.atenciones.crearVarias(nuevas.slice(i, i + 1000));
    return { importadas: nuevas.length, duplicadas };
  }
}

module.exports = { ImportadorService, importadorService: new ImportadorService() };
