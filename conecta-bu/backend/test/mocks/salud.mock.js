// Tablas en memoria del modulo Salud integral para el mock de Prisma.
// Implementa de forma generica el subconjunto de la API que usan los
// servicios: findUnique/findFirst/findMany/count/create/createMany/update/
// delete con where (igualdad, in, contains, startsWith, gte/lte, OR/AND),
// orderBy, skip/take, select e include de relaciones.

function igual(a, b) {
  if (a instanceof Date || b instanceof Date) return a && b && new Date(a).getTime() === new Date(b).getTime();
  return a === b;
}

function comparar(a, b) {
  const x = a instanceof Date ? a.getTime() : a;
  const y = b instanceof Date ? b.getTime() : b;
  if (x === y) return 0;
  if (x === null || x === undefined) return -1;
  if (y === null || y === undefined) return 1;
  return x < y ? -1 : 1;
}

function cumpleCampo(valor, filtro) {
  if (filtro === undefined) return true;
  if (filtro === null) return valor === null || valor === undefined;
  if (filtro instanceof Date || typeof filtro !== "object") return igual(valor, filtro);
  const insensible = filtro.mode === "insensitive";
  const txt = (v) => (insensible ? String(v ?? "").toLowerCase() : String(v ?? ""));
  if (filtro.equals !== undefined && !igual(valor, filtro.equals)) return false;
  if (filtro.in && !filtro.in.some((v) => igual(valor, v))) return false;
  if (filtro.not !== undefined && igual(valor, filtro.not)) return false;
  if (filtro.contains !== undefined && !txt(valor).includes(txt(filtro.contains))) return false;
  if (filtro.startsWith !== undefined && !txt(valor).startsWith(txt(filtro.startsWith))) return false;
  if (filtro.gte !== undefined && comparar(valor, filtro.gte) < 0) return false;
  if (filtro.lte !== undefined && comparar(valor, filtro.lte) > 0) return false;
  if (filtro.gt !== undefined && comparar(valor, filtro.gt) <= 0) return false;
  if (filtro.lt !== undefined && comparar(valor, filtro.lt) >= 0) return false;
  return true;
}

function cumpleWhere(registro, where = {}) {
  return Object.entries(where).every(([clave, filtro]) => {
    if (clave === "OR") return filtro.some((w) => cumpleWhere(registro, w));
    if (clave === "AND") return filtro.every((w) => cumpleWhere(registro, w));
    if (clave === "NOT") return !cumpleWhere(registro, filtro);
    return cumpleCampo(registro[clave], filtro);
  });
}

function ordenar(lista, orderBy) {
  if (!orderBy) return lista;
  const criterios = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...lista].sort((a, b) => {
    for (const c of criterios) {
      const [campo, dir] = Object.entries(c)[0];
      const r = comparar(a[campo], b[campo]);
      if (r) return dir === "desc" ? -r : r;
    }
    return 0;
  });
}

function seleccionar(registro, select) {
  if (!select) return registro;
  return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, registro[k]]));
}

function errorUnico(campos) {
  const err = new Error(`Unique constraint failed on the fields: (${campos.join(", ")})`);
  err.code = "P2002";
  return err;
}

function crearModelosSalud({ obtenerUsuarios, siguienteId }) {
  const tablas = { personas: [], actividades: [], atenciones: [], evidencias: [], accesos: [], reportesSst: [], adjuntosSst: [], informes: [], historicos: [], disciplinas: [], gruposDeporte: [], inscripcionesDeporte: [], sesionesDeporte: [], asistenciasDeporte: [], horasDeporte: [], configDeporte: [], salidas: [], inscripcionesSalida: [], bloqueos: [] };
  let consecutivoSst = 0;

  const usuarioPorId = (id) => {
    const u = obtenerUsuarios().find((x) => x.id === id);
    return u ? { ...u } : null;
  };

  // Relaciones por modelo: nombre -> funcion(registro, opciones) => valor.
  const relaciones = {
    personas: {
      atenciones: (r, o) => listar("atenciones", { ...(o === true ? {} : o), where: { ...(o?.where || {}), personaId: r.id } }),
    },
    actividades: {
      atenciones: (r, o) => listar("atenciones", { ...(o === true ? {} : o), where: { ...(o?.where || {}), actividadId: r.id } }),
      evidencias: (r, o) => listar("evidencias", { ...(o === true ? {} : o), where: { ...(o?.where || {}), actividadId: r.id } }),
    },
    atenciones: {
      persona: (r) => clonar(tablas.personas.find((p) => p.id === r.personaId)),
      actividad: (r) => clonar(tablas.actividades.find((a) => a.id === r.actividadId)),
      registradoPor: (r, o) => (r.registradoPorId ? seleccionar(usuarioPorId(r.registradoPorId), o?.select) : null),
    },
    accesos: {},
    reportesSst: {
      adjuntos: (r, o) => listar("adjuntosSst", { ...(o === true ? {} : o), where: { ...(o?.where || {}), reporteId: r.id } }),
      reportadoPor: (r, o) => seleccionar(usuarioPorId(r.reportadoPorId), o?.select),
    },
    informes: {},
    historicos: {},
    disciplinas: {},
    gruposDeporte: {},
    inscripcionesDeporte: {},
    sesionesDeporte: {},
    asistenciasDeporte: {},
    horasDeporte: {},
    configDeporte: {},
    salidas: {},
    inscripcionesSalida: {},
    bloqueos: {},
    adjuntosSst: {
      reporte: (r) => clonar(tablas.reportesSst.find((x) => x.id === r.reporteId)),
    },
    evidencias: {
      actividad: (r) => clonar(tablas.actividades.find((a) => a.id === r.actividadId)),
      subidoPor: (r, o) => (r.subidoPorId ? seleccionar(usuarioPorId(r.subidoPorId), o?.select) : null),
    },
  };

  const unicos = {
    personas: [["numeroDocumento"], ["codigoEstudiantil"]],
    actividades: [["periodo", "codigo"]],
    atenciones: [],
    evidencias: [],
    accesos: [["email", "modulo"]],
    reportesSst: [["consecutivo"]],
    informes: [["modulo", "periodo"]],
    historicos: [["periodo"]],
    disciplinas: [["nombre"]],
    gruposDeporte: [],
    inscripcionesDeporte: [["grupoId", "usuarioId"]],
    sesionesDeporte: [["grupoId", "fecha", "inicio"]],
    asistenciasDeporte: [["sesionId", "usuarioId"]],
    horasDeporte: [],
    configDeporte: [["id"]],
    salidas: [],
    inscripcionesSalida: [["salidaId", "usuarioId"]],
    bloqueos: [],
    adjuntosSst: [],
  };

  const defaults = {
    bloqueos: () => ({ todoElDia: true, horaInicio: null, horaFin: null, detalle: null, creadoPor: null, fechaCreacion: new Date() }),
    personas: () => ({
      tipoDocumento: "CC",
      codigoEstudiantil: null,
      telefono: null,
      correo: null,
      poblacion: "Estudiante",
      programa: null,
      consentimientoDatos: false,
      fechaConsentimiento: null,
      fechaCreacion: new Date(),
      fechaActualizacion: new Date(),
    }),
    actividades: () => ({
      tipoSnies: 1,
      permanente: false,
      clinica: false,
      meta: null,
      presupuesto: null,
      horasDedicacion: null,
      responsableDocumento: null,
      avances: null,
      dificultades: null,
      aprendizajes: null,
      pendientes: null,
      observaciones: null,
      activa: true,
      fechaCreacion: new Date(),
    }),
    atenciones: () => ({
      programa: null,
      examenLaboral: null,
      insumo: null,
      tensionArterial: null,
      frecuenciaCardiaca: null,
      frecuenciaRespiratoria: null,
      pesoKg: null,
      tallaCm: null,
      glucometria: null,
      descripcion: null,
      remitido: false,
      origen: "registro",
      registradoPorId: null,
      fechaRegistro: new Date(),
    }),
    evidencias: () => ({ descripcion: null, subidoPorId: null, fechaSubida: new Date() }),
    accesos: () => ({ asignadoPor: null, fechaAsignacion: new Date() }),
    reportesSst: () => ({
      consecutivo: ++consecutivoSst,
      estado: "Recibido",
      acompanantes: null,
      gestionExterna: false,
      observacionRevision: null,
      revisadoPor: null,
      fechaRevision: null,
      fueraDeTiempo: false,
      fechaCreacion: new Date(),
      fechaActualizacion: new Date(),
    }),
    adjuntosSst: () => ({ subidoPorId: null, fechaSubida: new Date() }),
    salidas: () => ({
      descripcion: null,
      programa: null,
      responsable: null,
      lugarEncuentro: null,
      horaSalida: null,
      horaRegreso: null,
      costo: null,
      infoPago: null,
      pideComprobante: false,
      estado: "Borrador",
      creadaPor: null,
      fechaCreacion: new Date(),
      fechaActualizacion: new Date(),
    }),
    inscripcionesSalida: () => ({
      tipoDocumento: "CC",
      contactoEmergencia: null,
      telefonoEmergencia: null,
      comprobante: null,
      comprobanteNombre: null,
      estado: "Pendiente",
      observacion: null,
      consentimiento: false,
      revisadoPor: null,
      fechaRevision: null,
      fechaInscripcion: new Date(),
      fechaActualizacion: new Date(),
    }),
    informes: () => ({
      modulo: "salud",
      fechaPresentacion: null,
      responsable: null,
      accionMejora: true,
      accionCorrectiva: true,
      accionPreventiva: true,
      descripcion: null,
      justificacion: null,
      alineacion: null,
      objetivos: null,
      logros: null,
      dificultades: null,
      accionesMejora: null,
      estado: "Borrador",
      version: 0,
      enviadoPor: null,
      fechaEnvio: null,
      observacionRevision: null,
      revisadoPor: null,
      fechaRevision: null,
      datosEnviados: null,
      fechaCreacion: new Date(),
      fechaActualizacion: new Date(),
    }),
    disciplinas: () => ({ descripcion: null, tipo: "Individual", activa: true, fechaCreacion: new Date() }),
    gruposDeporte: () => ({ instructor: null, lugar: null, cupo: 25, inscripcionesAbiertas: true, activo: true, fechaCreacion: new Date() }),
    inscripcionesDeporte: () => ({ estado: "Activa", fechaInscripcion: new Date(), fechaRetiro: null }),
    sesionesDeporte: () => ({ tema: null, registradaPor: null, fechaRegistro: new Date() }),
    asistenciasDeporte: () => ({ presente: true }),
    horasDeporte: () => ({ disciplinaId: null, registradoPor: null, fechaRegistro: new Date() }),
    configDeporte: () => ({ horasRequeridas: 40, maxGruposPorPeriodo: 2 }),
    historicos: () => ({ estudiantes: 0, docentes: 0, administrativos: 0, externos: 0, egresados: 0, enfermeria: null, poblacionGeneral: null }),
  };

  // Relaciones creadas en el mismo create ({ adjuntos: { create: [...] } }).
  const anidados = {
    reportesSst: { adjuntos: { tabla: "adjuntosSst", prefijo: "adjunto-sst", llave: "reporteId" } },
  };

  function clonar(r) {
    return r ? { ...r } : null;
  }

  function verificarUnicos(tabla, registro, excluirId) {
    for (const campos of unicos[tabla]) {
      if (campos.some((c) => registro[c] === null || registro[c] === undefined)) continue;
      const choque = tablas[tabla].find((x) => x.id !== excluirId && campos.every((c) => igual(x[c], registro[c])));
      if (choque) throw errorUnico(campos);
    }
  }

  function conIncludes(tabla, registro, include, select) {
    if (!registro) return null;
    let resultado = select ? seleccionar(registro, select) : { ...registro };
    for (const [rel, opciones] of Object.entries(include || {})) {
      if (!opciones) continue;
      resultado[rel] = relaciones[tabla][rel](registro, opciones);
      if (opciones && typeof opciones === "object" && opciones.include && resultado[rel] && !Array.isArray(resultado[rel])) {
        // include anidado en relaciones a uno (no usado por la app hoy).
      }
    }
    return resultado;
  }

  function listar(tabla, { where, include, orderBy, skip = 0, take, select } = {}) {
    let lista = tablas[tabla].filter((r) => cumpleWhere(r, where));
    lista = ordenar(lista, orderBy).slice(skip, take !== undefined ? skip + take : undefined);
    return lista.map((r) => conIncludes(tabla, r, include, select));
  }

  function buscarUnico(tabla, where) {
    // Llaves compuestas: { periodo_codigo: {...} }, { email_modulo: {...} }, { modulo_periodo: {...} }.
    const compuesta = Object.keys(where).find((k) => k.includes("_") && where[k] && typeof where[k] === "object");
    if (compuesta) return tablas[tabla].find((r) => cumpleWhere(r, where[compuesta]));
    return tablas[tabla].find((r) => cumpleWhere(r, where));
  }

  function modelo(tabla, prefijo) {
    return {
      findUnique: async ({ where, include, select }) => conIncludes(tabla, buscarUnico(tabla, where), include, select),
      findFirst: async ({ where, include, orderBy, select } = {}) => listar(tabla, { where, include, orderBy, take: 1, select })[0] || null,
      findMany: async (args = {}) => listar(tabla, args),
      count: async ({ where } = {}) => tablas[tabla].filter((r) => cumpleWhere(r, where)).length,
      create: async ({ data, include }) => {
        const hijos = [];
        const propios = { ...data };
        for (const [rel, def] of Object.entries(anidados[tabla] || {})) {
          if (propios[rel]?.create) hijos.push([def, [].concat(propios[rel].create)]);
          delete propios[rel];
        }
        for (const k of Object.keys(propios)) if (propios[k] === undefined) delete propios[k];
        const registro = { id: `${prefijo}-${siguienteId()}`, ...defaults[tabla](), ...propios };
        verificarUnicos(tabla, registro);
        tablas[tabla].push(registro);
        for (const [def, lista] of hijos) {
          for (const h of lista) tablas[def.tabla].push({ id: `${def.prefijo}-${siguienteId()}`, ...defaults[def.tabla](), ...h, [def.llave]: registro.id });
        }
        return conIncludes(tabla, registro, include);
      },
      createMany: async ({ data, skipDuplicates }) => {
        let count = 0;
        for (const d of data) {
          const registro = { id: `${prefijo}-${siguienteId()}`, ...defaults[tabla](), ...d };
          try {
            verificarUnicos(tabla, registro);
          } catch (err) {
            if (skipDuplicates) continue;
            throw err;
          }
          tablas[tabla].push(registro);
          count += 1;
        }
        return { count };
      },
      update: async ({ where, data, include }) => {
        const registro = buscarUnico(tabla, where);
        if (!registro) {
          const err = new Error("Record to update not found.");
          err.code = "P2025";
          throw err;
        }
        const nuevo = { ...registro, ...data, ...(["personas", "reportesSst", "informes", "salidas", "inscripcionesSalida"].includes(tabla) ? { fechaActualizacion: new Date() } : {}) };
        verificarUnicos(tabla, nuevo, registro.id);
        Object.assign(registro, nuevo);
        return conIncludes(tabla, registro, include);
      },
      delete: async ({ where }) => {
        const registro = buscarUnico(tabla, where);
        tablas[tabla] = tablas[tabla].filter((r) => r !== registro);
        return registro;
      },
      deleteMany: async ({ where } = {}) => {
        const antes = tablas[tabla].length;
        tablas[tabla] = tablas[tabla].filter((r) => !cumpleWhere(r, where));
        return { count: antes - tablas[tabla].length };
      },
    };
  }

  return {
    modelos: {
      personaSalud: modelo("personas", "persona"),
      actividadSalud: modelo("actividades", "actividad-salud"),
      atencionSalud: modelo("atenciones", "atencion"),
      evidenciaSalud: modelo("evidencias", "evidencia"),
      accesoModulo: modelo("accesos", "acceso"),
      reporteSST: modelo("reportesSst", "reporte-sst"),
      adjuntoReporteSST: modelo("adjuntosSst", "adjunto-sst"),
      informeGestion: modelo("informes", "informe"),
      historicoSalud: modelo("historicos", "historico"),
      disciplinaDeportiva: modelo("disciplinas", "disciplina"),
      grupoDeporte: modelo("gruposDeporte", "grupo"),
      inscripcionDeporte: modelo("inscripcionesDeporte", "insc"),
      sesionDeporte: modelo("sesionesDeporte", "sesion"),
      asistenciaDeporte: modelo("asistenciasDeporte", "asis"),
      horaDeporteManual: modelo("horasDeporte", "hora"),
      configDeporte: modelo("configDeporte", "config"),
      salidaConvocatoria: modelo("salidas", "salida"),
      inscripcionSalida: modelo("inscripcionesSalida", "insal"),
      bloqueoAgenda: modelo("bloqueos", "bloqueo"),
    },
    reset() {
      tablas.personas = [];
      tablas.actividades = [];
      tablas.atenciones = [];
      tablas.evidencias = [];
      tablas.accesos = [];
      tablas.reportesSst = [];
      tablas.adjuntosSst = [];
      tablas.informes = [];
      tablas.historicos = [];
      tablas.disciplinas = [];
      tablas.gruposDeporte = [];
      tablas.inscripcionesDeporte = [];
      tablas.sesionesDeporte = [];
      tablas.asistenciasDeporte = [];
      tablas.horasDeporte = [];
      tablas.configDeporte = [];
      tablas.salidas = [];
      tablas.inscripcionesSalida = [];
      tablas.bloqueos = [];
      consecutivoSst = 0;
    },
    tablas,
  };
}

module.exports = { crearModelosSalud, cumpleWhere };
