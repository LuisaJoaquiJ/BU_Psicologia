const { AppError } = require("../../../common/utils/AppError");
const { hoyBogota } = require("../../../common/utils/fechas");
const repos = require("../repositories");
const imagenes = require("./ImagenService");
const disciplinas = require("./DisciplinaService");
const u = require("../utils");

// Inventario de implementos deportivos: existencias y cada movimiento (quien,
// cuando y por que). disponibles = total - danados - prestados sin devolver.
class InventarioService {
  // { mapa: Map(implementoId -> unidades prestadas), activos: prestamos sin devolver }.
  async prestados(ids) {
    const activos = await repos.prestamos.activos(ids);
    return { mapa: u.contarPor(activos, "implementoId", (p) => p.cantidad), activos };
  }

  serializar(i, prestados, listaDisciplinas) {
    const enPrestamo = prestados.get(i.id) || 0;
    const disponibles = Math.max(0, i.cantidadTotal - i.cantidadDanada - enPrestamo);
    return {
      ...imagenes.conImagen("implementos", i),
      disciplina: listaDisciplinas.find((d) => d.id === i.disciplinaId)?.nombre || null,
      enPrestamo,
      disponibles,
      bajoStock: i.activo && i.stockMinimo > 0 && disponibles <= i.stockMinimo,
    };
  }

  async obtenerOFallar(id) {
    const implemento = await repos.implementos.buscarPorId(id);
    if (!implemento) throw new AppError(404, "El implemento no existe.");
    return implemento;
  }

  async disponiblesDe(implemento) {
    const prestados = (await this.prestados([implemento.id])).mapa.get(implemento.id) || 0;
    return implemento.cantidadTotal - implemento.cantidadDanada - prestados;
  }

  registrarMovimiento(implementoId, tipo, cantidad, motivo, registradoPor) {
    return repos.movimientos.crear({ implementoId, tipo, cantidad, motivo: u.texto(motivo, 300), registradoPor: registradoPor || null });
  }

  async listar() {
    const hoy = hoyBogota();
    const [implementos, lista, { mapa, activos }] = await Promise.all([repos.implementos.listar({}, { nombre: "asc" }), repos.disciplinas.listar(), this.prestados()]);
    const todos = implementos.map((i) => this.serializar(i, mapa, lista));
    const vigentes = todos.filter((i) => i.activo);
    const suma = (campo) => vigentes.reduce((s, i) => s + i[campo], 0);
    return {
      implementos: todos,
      resumen: {
        referencias: vigentes.length,
        unidades: suma("cantidadTotal"),
        disponibles: suma("disponibles"),
        enPrestamo: suma("enPrestamo"),
        danados: suma("cantidadDanada"),
        bajoStock: vigentes.filter((i) => i.bajoStock).length,
        prestamosActivos: activos.length,
        prestamosVencidos: activos.filter((p) => new Date(p.fechaDevolucionEsperada) < hoy).length,
      },
    };
  }

  async crear(cuerpo, registradoPor) {
    const data = this.datos(cuerpo);
    const cantidad = u.entero(cuerpo.cantidad ?? 0, "La cantidad inicial", 0, 100000);
    if (data.disciplinaId) await disciplinas.exigirExistente(data.disciplinaId);
    await this.validarCodigoLibre(data.codigo);
    const implemento = await repos.implementos.crear({ ...data, cantidadTotal: cantidad });
    if (cantidad > 0) await this.registrarMovimiento(implemento.id, "Ingreso", cantidad, u.texto(cuerpo.motivo, 300) || "Registro inicial", registradoPor);
    return this.detalle(implemento.id);
  }

  async actualizar(id, cuerpo) {
    await this.obtenerOFallar(id);
    const data = this.datos(cuerpo, true);
    await this.validarCodigoLibre(data.codigo, id);
    await repos.implementos.actualizar(id, data);
    return this.detalle(id);
  }

  async detalle(id) {
    const implemento = await this.obtenerOFallar(id);
    const [lista, prestamos, movimientos, { mapa }] = await Promise.all([
      repos.disciplinas.listar(),
      repos.prestamos.listar({ implementoId: id }, { fechaPrestamo: "desc" }),
      repos.movimientos.listar({ implementoId: id }, { fecha: "desc" }),
      this.prestados([id]),
    ]);
    const hoy = hoyBogota();
    return {
      ...this.serializar(implemento, mapa, lista),
      prestamos: prestamos.map((p) => ({ ...p, fechaDevolucionEsperada: u.fechaISO(p.fechaDevolucionEsperada), vencido: !p.fechaDevolucion && new Date(p.fechaDevolucionEsperada) < hoy })),
      movimientos: movimientos.slice(0, 50),
    };
  }

  // Ingreso (compra, donacion), Baja (perdida, desgaste), Danado (pasa a
  // danados) o Reparacion (vuelve de danados a disponibles).
  async ajustarExistencias(id, cuerpo, registradoPor) {
    const implemento = await this.obtenerOFallar(id);
    const tipo = cuerpo.tipo;
    if (!u.TIPOS_AJUSTE.includes(tipo)) throw new AppError(400, "El movimiento debe ser Ingreso, Baja, Danado o Reparacion.");
    const cantidad = u.entero(cuerpo.cantidad, "La cantidad", 1, 100000);
    const motivo = u.texto(cuerpo.motivo, 300);
    if (!motivo && tipo !== "Ingreso") throw new AppError(400, "Escribe el motivo del movimiento.");
    const data = this.cambioDeExistencias(implemento, tipo, cantidad, await this.disponiblesDe(implemento));
    await repos.implementos.actualizar(id, data);
    await this.registrarMovimiento(id, tipo, cantidad, motivo, registradoPor);
    return this.detalle(id);
  }

  cambioDeExistencias(implemento, tipo, cantidad, disponibles) {
    const { cantidadTotal: total, cantidadDanada: danados } = implemento;
    if (tipo === "Ingreso") return { cantidadTotal: total + cantidad };
    if (tipo === "Danado") {
      if (cantidad > disponibles) throw new AppError(409, `Solo hay ${disponibles} disponible(s) para marcar como dañados.`);
      return { cantidadDanada: danados + cantidad };
    }
    if (tipo === "Reparacion") {
      if (cantidad > danados) throw new AppError(409, `Solo hay ${danados} dañado(s).`);
      return { cantidadDanada: danados - cantidad };
    }
    // Baja: primero los danados y luego los disponibles; nunca los prestados.
    if (cantidad > danados + disponibles) throw new AppError(409, `Solo se pueden dar de baja ${danados + disponibles} (los prestados deben devolverse antes).`);
    return { cantidadDanada: danados - Math.min(cantidad, danados), cantidadTotal: total - cantidad };
  }

  async validarCodigoLibre(codigo, id) {
    if (!codigo) return;
    const otro = await repos.implementos.buscarUno({ codigo });
    if (otro && otro.id !== id) throw new AppError(409, `El código ${codigo} ya lo usa «${otro.nombre}».`);
  }

  datos(cuerpo = {}, parcial = false) {
    const data = {};
    if (!parcial || cuerpo.nombre !== undefined) {
      data.nombre = u.texto(cuerpo.nombre, 120);
      if (!data.nombre) throw new AppError(400, "Escribe el nombre del implemento.");
    }
    if (cuerpo.codigo !== undefined) data.codigo = u.texto(cuerpo.codigo, 30)?.toUpperCase() || null;
    if (cuerpo.descripcion !== undefined) data.descripcion = u.texto(cuerpo.descripcion, 600);
    if (cuerpo.disciplinaId !== undefined) data.disciplinaId = cuerpo.disciplinaId || null;
    if (cuerpo.ubicacion !== undefined) data.ubicacion = u.texto(cuerpo.ubicacion, 120);
    if (cuerpo.stockMinimo !== undefined) data.stockMinimo = u.entero(cuerpo.stockMinimo || 0, "El stock mínimo", 0, 10000);
    if (cuerpo.activo !== undefined) data.activo = cuerpo.activo === true;
    return data;
  }
}

module.exports = new InventarioService();
