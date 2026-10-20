const { prisma } = require("../../../config/prisma");
const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");
const { reposCon } = require("../repositories");
const { ordenPeriodo } = require("../utils/informe/series");
const { entero } = require("../utils/informe/edicion");

// Cifras historicas de años anteriores para las series del informe.
class HistoricoService {
  constructor(r = repos) {
    this.repos = r;
  }

  async listar() {
    return (await this.repos.historicos.listar()).sort((a, b) => ordenPeriodo(a.periodo) - ordenPeriodo(b.periodo));
  }

  limpiar(f) {
    const periodo = String(f.periodo || "").trim();
    if (!/^\d{4}(-[12])?$/.test(periodo)) throw new AppError(400, `El periodo "${periodo}" no es válido (usa AAAA o AAAA-1).`);
    return {
      periodo,
      estudiantes: entero(f.estudiantes, "estudiantes"),
      docentes: entero(f.docentes, "docentes"),
      administrativos: entero(f.administrativos, "administrativos"),
      externos: entero(f.externos, "externos"),
      egresados: entero(f.egresados, "egresados"),
      enfermeria: entero(f.enfermeria, "enfermería", true),
      poblacionGeneral: entero(f.poblacionGeneral, "población general", true),
    };
  }

  // Reemplaza todas las cifras historicas por las enviadas.
  async guardar(filas) {
    if (!Array.isArray(filas)) throw new AppError(400, "Envía la lista de periodos.");
    const limpias = filas.map((f) => this.limpiar(f));
    const repetido = limpias.find((f, i) => limpias.findIndex((x) => x.periodo === f.periodo) !== i);
    if (repetido) throw new AppError(400, `El periodo ${repetido.periodo} está repetido.`);
    await prisma.$transaction(async (tx) => {
      const r = reposCon(tx);
      await r.historicos.eliminarTodos();
      for (const f of limpias) await r.historicos.crear(f);
    });
    return this.listar();
  }
}

module.exports = { HistoricoService, historicoService: new HistoricoService() };
