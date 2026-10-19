const repos = require("../repositories");
const cat = require("../utils/sst");
const { texto } = require("../utils/sst/validacion");
const { normal, nombrePropio } = require("../utils/texto");

// Al escribir el nombre de quien viaja se sugieren personas ya conocidas
// (docentes y administrativos registrados en Salud, y quienes ya viajaron en
// otros reportes) para llenar su cedula. Solo devuelve nombre y documento.
const TIPOS_DOC_SST = new Set(cat.TIPOS_DOCUMENTO);
const MAXIMO = 8;

class SstPersonaService {
  constructor(r = repos) {
    this.repos = r;
  }

  async buscar(q) {
    const busqueda = texto(q, 60);
    if (!busqueda || busqueda.length < 2) return [];
    const doc = busqueda.replace(/[.\s]/g, "");
    const esDocumento = /^\d{3,}$/.test(doc);
    const claves = busqueda.split(" ").filter(Boolean).slice(0, 4).map(normal);
    // Se filtra aqui (no en SQL) para ignorar tildes: "gomez" encuentra "Gómez".
    const coincide = (nombre, documento) => (esDocumento ? String(documento || "").startsWith(doc) : claves.every((w) => normal(nombre).includes(w)));
    const encontradas = new Map();
    const agregar = (p) => {
      if (p.documento && !encontradas.has(p.documento) && encontradas.size < MAXIMO) encontradas.set(p.documento, p);
    };

    for (const p of await this.repos.personas.docentesYAdministrativos(esDocumento ? doc : null)) {
      if (!coincide(`${p.nombres} ${p.apellidos}`, p.numeroDocumento)) continue;
      agregar({ nombre: nombrePropio(`${p.nombres} ${p.apellidos}`), tipoDocumento: TIPOS_DOC_SST.has(p.tipoDocumento) ? p.tipoDocumento : "CC", documento: p.numeroDocumento, detalle: p.poblacion });
    }
    if (encontradas.size < MAXIMO) {
      for (const r of await this.repos.reportesSst.personasRecientes()) {
        if (r.responsableNombre && coincide(r.responsableNombre, r.responsableDocumento)) {
          agregar({ nombre: r.responsableNombre, tipoDocumento: r.responsableTipoDoc || "CC", documento: r.responsableDocumento, detalle: "Reporte anterior" });
        }
        for (const a of Array.isArray(r.acompanantes) ? r.acompanantes : []) {
          if (coincide(a.nombre, a.documento)) agregar({ nombre: a.nombre, tipoDocumento: "CC", documento: a.documento, detalle: "Reporte anterior" });
        }
      }
    }
    return [...encontradas.values()];
  }
}

module.exports = { SstPersonaService, sstPersonaService: new SstPersonaService() };
