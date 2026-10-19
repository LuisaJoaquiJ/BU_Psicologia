const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");
const { limpiarIdentificador, normal, esConflictoUnico } = require("../utils/texto");
const { validarPersona } = require("../utils/registro");

// Personas atendidas por la Unidad de Salud (estudiantes, docentes,
// administrativos, egresados y externos). Se registran una sola vez; luego
// basta el numero de documento o el codigo estudiantil.
class PersonaService {
  constructor(r = repos) {
    this.repos = r;
  }

  porIdentificador(identificador) {
    const id = limpiarIdentificador(identificador);
    return id ? this.repos.personas.porIdentificador(id) : null;
  }

  // Registro rapido: coincidencia exacta por documento o codigo y, si se
  // escribio un nombre, coincidencias parciales por nombre o apellido.
  async buscar(q) {
    const texto = String(q || "").trim();
    if (texto.length < 2) return { exacta: null, coincidencias: [] };
    const exacta = await this.porIdentificador(texto);
    let coincidencias = [];
    if (!exacta && /\p{L}/u.test(texto)) {
      const partes = texto.split(/\s+/).filter(Boolean).slice(0, 3);
      const candidatos = await this.repos.personas.porNombre(partes[0]);
      coincidencias = candidatos.filter((p) => partes.every((parte) => normal(`${p.nombres} ${p.apellidos}`).includes(normal(parte)))).slice(0, 8);
    } else if (!exacta && /^\d{4,}$/.test(limpiarIdentificador(texto))) {
      // Documento incompleto: sugiere los que empiezan igual.
      coincidencias = await this.repos.personas.documentoEmpiezaPor(limpiarIdentificador(texto));
    }
    return { exacta, coincidencias };
  }

  async crear(datos) {
    const limpio = validarPersona(datos);
    // Ley 1581 de 2012: sin autorizacion no se guardan los datos.
    if (!limpio.consentimientoDatos) {
      throw new AppError(400, "La persona debe autorizar el tratamiento de sus datos (Ley 1581 de 2012).", "SIN_CONSENTIMIENTO");
    }
    return this.guardar(() => this.repos.personas.crear(limpio));
  }

  async guardar(fn) {
    try {
      return await fn();
    } catch (err) {
      if (esConflictoUnico(err)) throw new AppError(409, "Ya existe una persona con ese documento o código estudiantil.");
      throw err;
    }
  }

  async obtenerOFallar(id) {
    const persona = await this.repos.personas.buscarPorId(id);
    if (!persona) throw new AppError(404, "La persona no existe.");
    return persona;
  }

  async actualizar(id, datos) {
    await this.obtenerOFallar(id);
    const limpio = validarPersona(datos, { parcial: true });
    return this.guardar(() => this.repos.personas.actualizar(id, limpio));
  }

  async obtener(id) {
    const persona = await this.obtenerOFallar(id);
    return { ...persona, atenciones: await this.repos.atenciones.dePersona(id) };
  }

  async listar({ q, poblacion, pagina = 1 } = {}) {
    const where = {};
    if (poblacion) where.poblacion = poblacion;
    const texto = String(q || "").trim();
    if (texto) {
      const id = limpiarIdentificador(texto);
      where.OR = [
        { nombres: { contains: texto, mode: "insensitive" } },
        { apellidos: { contains: texto, mode: "insensitive" } },
        ...(id ? [{ numeroDocumento: { startsWith: id } }, { codigoEstudiantil: { startsWith: id } }] : []),
      ];
    }
    const porPagina = 25;
    const [total, personas] = await Promise.all([this.repos.personas.contar(where), this.repos.personas.pagina(where, Math.max(1, Number(pagina)), porPagina)]);
    return { total, pagina: Number(pagina) || 1, porPagina, personas };
  }

  // Participaciones del estudiante (sin datos clinicos), por su correo.
  async participacionesDe(correo, categorias) {
    const persona = await this.repos.personas.porCorreo(correo.toLowerCase());
    if (!persona) return { vinculado: false, participaciones: [] };
    const atenciones = await this.repos.atenciones.participaciones(persona.id);
    return {
      vinculado: true,
      participaciones: atenciones.map((a) => ({ id: a.id, fecha: a.fecha, actividad: a.actividad?.nombre, categoria: categorias[a.actividad?.categoria] || null })),
    };
  }
}

module.exports = { PersonaService, personaService: new PersonaService() };
