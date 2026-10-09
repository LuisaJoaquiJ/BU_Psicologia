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
  const tablas = { personas: [], actividades: [], atenciones: [], evidencias: [] };

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
  };

  const defaults = {
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
    if (where.periodo_codigo) return tablas[tabla].find((r) => cumpleWhere(r, where.periodo_codigo));
    return tablas[tabla].find((r) => cumpleWhere(r, where));
  }

  function modelo(tabla, prefijo) {
    return {
      findUnique: async ({ where, include, select }) => conIncludes(tabla, buscarUnico(tabla, where), include, select),
      findFirst: async ({ where, include, orderBy, select } = {}) => listar(tabla, { where, include, orderBy, take: 1, select })[0] || null,
      findMany: async (args = {}) => listar(tabla, args),
      count: async ({ where } = {}) => tablas[tabla].filter((r) => cumpleWhere(r, where)).length,
      create: async ({ data, include }) => {
        const registro = { id: `${prefijo}-${siguienteId()}`, ...defaults[tabla](), ...data };
        verificarUnicos(tabla, registro);
        tablas[tabla].push(registro);
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
        const nuevo = { ...registro, ...data, ...(tabla === "personas" ? { fechaActualizacion: new Date() } : {}) };
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
    },
    reset() {
      tablas.personas = [];
      tablas.actividades = [];
      tablas.atenciones = [];
      tablas.evidencias = [];
    },
    tablas,
  };
}

module.exports = { crearModelosSalud, cumpleWhere };
