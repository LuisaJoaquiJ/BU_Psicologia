const repos = require("../repositories");
const cat = require("../utils/sst");
const { texto } = require("../utils/sst/validacion");
const { normal, nombrePropio } = require("../utils/texto");
const { enmascarar, cifrar } = require("../utils/sst/documentoProtegido");

// Al escribir el nombre de quien viaja se sugieren personas ya conocidas
// (docentes y administrativos registrados en Salud, y quienes ya viajaron en
// otros reportes) para llenar su cedula. Se busca solo por nombre y la cedula
// sale enmascarada, con una referencia cifrada que el servidor abre al
// guardar (ver documentoProtegido): asi no se pueden recorrer cedulas ajenas.
const TIPOS_DOC_SST = new Set(cat.TIPOS_DOCUMENTO);
const MAXIMO = 8;

class SstPersonaService {
  constructor(r = repos) {
    this.repos = r;
  }

  async buscar(q) {
    const busqueda = texto(q, 60);
    if (!busqueda || busqueda.replace(/[^\p{L}]/gu, "").length < 3) return [];
    const claves = busqueda.split(" ").filter(Boolean).slice(0, 4).map(normal);
    // Se filtra aqui (no en SQL) para ignorar tildes: "gomez" encuentra "Gómez".
    const coincide = (nombre) => claves.every((w) => normal(nombre).includes(w));
    const encontradas = new Map();
    const agregar = (p) => {
      if (p.documento && !encontradas.has(p.documento) && encontradas.size < MAXIMO) encontradas.set(p.documento, p);
    };

    for (const p of await this.repos.personas.docentesYAdministrativos()) {
      if (!coincide(`${p.nombres} ${p.apellidos}`)) continue;
      agregar({ nombre: nombrePropio(`${p.nombres} ${p.apellidos}`), tipoDocumento: TIPOS_DOC_SST.has(p.tipoDocumento) ? p.tipoDocumento : "CC", documento: p.numeroDocumento, detalle: p.poblacion });
    }
    if (encontradas.size < MAXIMO) {
      for (const r of await this.repos.reportesSst.personasRecientes()) {
        if (r.responsableNombre && coincide(r.responsableNombre)) {
          agregar({ nombre: r.responsableNombre, tipoDocumento: r.responsableTipoDoc || "CC", documento: r.responsableDocumento, detalle: "Reporte anterior" });
        }
        for (const a of Array.isArray(r.acompanantes) ? r.acompanantes : []) {
          if (coincide(a.nombre)) agregar({ nombre: a.nombre, tipoDocumento: "CC", documento: a.documento, detalle: "Reporte anterior" });
        }
      }
    }
    return [...encontradas.values()].map(({ documento, ...p }) => ({ ...p, documento: enmascarar(documento), documentoRef: cifrar(documento) }));
  }
}

module.exports = { SstPersonaService, sstPersonaService: new SstPersonaService() };
