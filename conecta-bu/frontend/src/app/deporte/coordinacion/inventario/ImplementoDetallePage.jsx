import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Aviso, Campo, Insignia, Tarjeta, Vacio, botonPrimario, botonSecundario, claseCampo } from "../../comunes/componentes/ui";
import { useConfirmar } from "../../comunes/componentes/Confirmar";
import { Icono } from "../../comunes/componentes/Iconos";
import { SelectorFoto, fotoInicial, guardarFoto } from "../../comunes/componentes/SelectorFoto";
import { http } from "../../../../lib/api/http";
import { fechaCorta, hoyISO } from "../../comunes/lib/deporte";
import { mensajeError } from "../../comunes/lib/salud";
import { Pastillas } from "../../comunes/Pastillas";
import { IconoDisciplina } from "../../comunes/Progreso";
import { CONTENEDOR } from "../../comunes/estilos";
import { useCatalogosDeporte } from "../../comunes/useCatalogosDeporte";
import { BarraExistencias, enDias } from "./Existencias";
import { FilaPrestamo } from "./Prestamos";
import { ACCIONES, AYUDA_ACCION, TEXTO_MOV, TONO_MOV } from "./acciones";

// Detalle de un implemento: existencias, préstamo, ajustes y movimientos.

export function ImplementoDetallePage() {
  const { id } = useParams();
  const { cat } = useCatalogosDeporte();
  const [i, setI] = useState(null);
  const [accion, setAccion] = useState(null);
  const [form, setForm] = useState({});
  const [grupos, setGrupos] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const { confirmar, avisar } = useConfirmar();
  useEffect(() => {
    http
      .get(`/deporte/admin/inventario/${id}`)
      .then((r) => setI(r.data.implemento))
      .catch((err) => setError(mensajeError(err, "No fue posible cargar el implemento.")));
    http.get("/deporte/admin/grupos").then((r) => setGrupos(r.data.grupos));
  }, [id]);

  function abrir(a) {
    setAccion(a);
    setError("");
    setForm(a === "prestar" ? { cantidad: 1, tipoResponsable: "Estudiante", responsable: "", responsableEmail: "", grupoId: "", fechaDevolucionEsperada: enDias(1), observacion: "" } : { cantidad: 1, motivo: "" });
  }

  async function guardar(e) {
    e.preventDefault();
    setError("");
    const n = Number(form.cantidad);
    const unidades = `${n} unidad${n === 1 ? "" : "es"}`;
    const grupo = grupos.find((g) => g.id === form.grupoId)?.nombre;
    const pregunta =
      accion === "prestar"
        ? { titulo: `¿Prestar ${unidades} de ${i.nombre}?`, detalle: [["A", form.tipoResponsable === "Grupo" ? grupo : form.responsable], ["Tipo", form.tipoResponsable], ["Devolver el", fechaCorta(form.fechaDevolucionEsperada)], ["Quedarán disponibles", i.disponibles - n]], boton: "Sí, prestar" }
        : accion === "editar"
          ? { titulo: "¿Guardar los cambios del implemento?", detalle: [["Nombre", form.nombre], ["Ubicación", form.ubicacion], ["Stock mínimo", form.stockMinimo], ["Estado", form.activo ? "Activo" : "Inactivo"], ["Foto", form.foto?.archivo ? `Nueva: ${form.foto.archivo.name}` : form.foto?.quitar && i.imagenUrl ? "Se quita" : "Sin cambios"]], boton: "Sí, guardar" }
          : {
              Ingreso: { titulo: `¿Registrar el ingreso de ${unidades}?`, mensaje: `El total pasa de ${i.cantidadTotal} a ${i.cantidadTotal + n}.`, boton: "Sí, registrar" },
              Danado: { titulo: `¿Marcar ${unidades} como dañadas?`, mensaje: "No se podrán prestar hasta que se marquen como reparadas.", boton: "Sí, marcar", peligro: true },
              Reparacion: { titulo: `¿Marcar ${unidades} como reparadas?`, mensaje: "Vuelven a estar disponibles para préstamo.", boton: "Sí, reparadas" },
              Baja: { titulo: `¿Dar de baja ${unidades}?`, mensaje: `Salen del inventario (el total pasa de ${i.cantidadTotal} a ${i.cantidadTotal - n}). No se puede deshacer, salvo con un nuevo ingreso.`, boton: "Sí, dar de baja", peligro: true },
            }[accion];
    if (!(await confirmar({ ...pregunta, detalle: pregunta.detalle || (form.motivo ? [["Motivo", form.motivo]] : undefined) }))) return;
    try {
      const r =
        accion === "prestar"
          ? await http.post(`/deporte/admin/inventario/${id}/prestamos`, { ...form, cantidad: Number(form.cantidad) })
          : accion === "editar"
            ? await http.patch(`/deporte/admin/inventario/${id}`, { ...form, foto: undefined, stockMinimo: Number(form.stockMinimo || 0) })
            : await http.post(`/deporte/admin/inventario/${id}/movimientos`, { tipo: accion, cantidad: Number(form.cantidad), motivo: form.motivo });
      let fallo = "";
      if (accion === "editar" && form.foto) {
        fallo = await guardarFoto(`/deporte/admin/inventario/${id}/imagen`, form.foto, i.imagenUrl);
        if (!fallo && (form.foto.archivo || form.foto.quitar)) r.data.implemento = (await http.get(`/deporte/admin/inventario/${id}`)).data.implemento;
      }
      setI(r.data.implemento);
      const mensaje = accion === "prestar" ? `Préstamo registrado a ${form.tipoResponsable === "Grupo" ? grupo : form.responsable}.` : accion === "editar" ? `Datos actualizados.${fallo ? ` ${fallo}` : ""}` : "Movimiento registrado.";
      setAviso(mensaje);
      avisar(mensaje, fallo ? "error" : "exito");
      setAccion(null);
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar."));
    }
  }

  if (!i) return <main className={CONTENEDOR}>{error ? <Aviso>{error}</Aviso> : <p className="text-ink-500">Cargando…</p>}</main>;
  const activos = i.prestamos.filter((p) => !p.fechaDevolucion);
  const max = accion === "prestar" || accion === "Danado" ? i.disponibles : accion === "Reparacion" ? i.cantidadDanada : accion === "Baja" ? i.disponibles + i.cantidadDanada : undefined;
  return (
    <main className={`${CONTENEDOR} flex flex-col gap-6`}>
      <Link to="/deporte/inventario" className="text-sm font-bold text-primary-soft inline-flex items-center gap-1 w-fit">
        <Icono nombre="izquierda" size={16} /> Inventario
      </Link>
      <div className="flex items-start gap-4 flex-wrap">
        <IconoDisciplina nombre={i.disciplina || i.nombre} tamano={i.imagenUrl ? 96 : 56} imagen={i.imagenUrl} />
        <div className="flex-1 min-w-0">
          <p className="m-0 text-sm font-semibold text-ink-500">{[i.codigo, i.disciplina || "General", i.ubicacion].filter(Boolean).join(" · ")}</p>
          <h1 className="m-0 mt-1 text-[30px] font-extrabold">{i.nombre}</h1>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {i.bajoStock && <Insignia tono="dorado">Bajo stock (mínimo {i.stockMinimo})</Insignia>}
            {!i.activo && <Insignia tono="gris">Inactivo</Insignia>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setAccion("editar");
            setForm({ nombre: i.nombre, codigo: i.codigo || "", disciplinaId: i.disciplinaId || "", ubicacion: i.ubicacion || "", stockMinimo: i.stockMinimo, activo: i.activo, foto: fotoInicial(i.imagenUrl) });
          }}
          className={botonSecundario}
        >
          <Icono nombre="editar" size={15} /> Editar
        </button>
      </div>
      {error && !accion && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}

      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {[
            ["Total", i.cantidadTotal, "text-primary"],
            ["Disponibles", i.disponibles, "text-[#0B6B61]"],
            ["En préstamo", i.enPrestamo, "text-[#1C5CAB]"],
            ["Dañados", i.cantidadDanada, "text-[#8A4B00]"],
          ].map(([t, v, c]) => (
            <div key={t}>
              <p className="m-0 text-xs text-ink-500">{t}</p>
              <p className={`m-0 text-3xl font-extrabold tabular-nums ${c}`}>{v}</p>
            </div>
          ))}
        </div>
        <BarraExistencias i={i} />
        <div className="flex flex-wrap gap-2">
          {ACCIONES.map(([a, t, icono]) => (
            <button
              key={a}
              type="button"
              aria-pressed={accion === a}
              onClick={() => abrir(a)}
              className={`min-h-[42px] px-4 rounded-full border text-sm font-bold inline-flex items-center gap-2 ${accion === a ? "bg-primary-dark border-primary-dark text-white" : "bg-white border-gray-200 text-ink-700 hover:border-primary/50"}`}
            >
              <Icono nombre={icono} size={15} /> {t}
            </button>
          ))}
        </div>
        {accion && (
          <form onSubmit={guardar} className="rounded-2xl bg-gray-50 border border-gray-200 p-4 flex flex-col gap-3">
            {accion === "editar" ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Campo etiqueta="Nombre">
                  <input required value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} className={claseCampo} />
                </Campo>
                <Campo etiqueta="Código">
                  <input value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} className={claseCampo} />
                </Campo>
                <Campo etiqueta="Disciplina">
                  <select value={form.disciplinaId} onChange={(e) => setForm((f) => ({ ...f, disciplinaId: e.target.value }))} className={claseCampo}>
                    <option value="">General</option>
                    {cat?.disciplinas.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo etiqueta="Ubicación">
                  <input value={form.ubicacion} onChange={(e) => setForm((f) => ({ ...f, ubicacion: e.target.value }))} className={claseCampo} />
                </Campo>
                <Campo etiqueta="Stock mínimo">
                  <input type="number" min="0" value={form.stockMinimo} onChange={(e) => setForm((f) => ({ ...f, stockMinimo: e.target.value }))} className={claseCampo} />
                </Campo>
                <label className="flex items-center gap-2.5 text-sm font-semibold text-ink-700 cursor-pointer self-end min-h-[44px]">
                  <input type="checkbox" checked={form.activo} onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))} className="w-4 h-4 accent-[#0B2A5B]" />
                  Activo
                </label>
                <div className="sm:col-span-2 lg:col-span-3">
                  <SelectorFoto foto={form.foto || fotoInicial(null)} onCambio={(foto) => setForm((f) => ({ ...f, foto }))} etiqueta="Foto" />
                </div>
              </div>
            ) : accion === "prestar" ? (
              <>
                <Pastillas etiqueta="¿A quién?" opciones={["Estudiante", "Docente", "Grupo", "Otro"]} valor={form.tipoResponsable} onCambio={(v) => setForm((f) => ({ ...f, tipoResponsable: v }))} />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Campo etiqueta={`Cantidad (hay ${i.disponibles})`}>
                    <input type="number" min="1" max={i.disponibles} required value={form.cantidad} onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))} className={claseCampo} />
                  </Campo>
                  {form.tipoResponsable === "Grupo" ? (
                    <Campo etiqueta="Grupo">
                      <select required value={form.grupoId} onChange={(e) => setForm((f) => ({ ...f, grupoId: e.target.value }))} className={claseCampo}>
                        <option value="">Elige el grupo</option>
                        {grupos.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.nombre}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  ) : (
                    <Campo etiqueta="Nombre del responsable">
                      <input required maxLength={150} value={form.responsable} onChange={(e) => setForm((f) => ({ ...f, responsable: e.target.value }))} className={claseCampo} />
                    </Campo>
                  )}
                  <Campo etiqueta="Correo (opcional)">
                    <input type="email" value={form.responsableEmail} onChange={(e) => setForm((f) => ({ ...f, responsableEmail: e.target.value }))} className={claseCampo} />
                  </Campo>
                  <Campo etiqueta="Devolver el">
                    <input type="date" required min={hoyISO()} value={form.fechaDevolucionEsperada} onChange={(e) => setForm((f) => ({ ...f, fechaDevolucionEsperada: e.target.value }))} className={claseCampo} />
                  </Campo>
                </div>
                <Campo etiqueta="Observación (opcional)">
                  <input maxLength={300} value={form.observacion} onChange={(e) => setForm((f) => ({ ...f, observacion: e.target.value }))} placeholder="Para el torneo del sábado" className={claseCampo} />
                </Campo>
              </>
            ) : (
              <>
                <p className="m-0 text-sm text-ink-600">{AYUDA_ACCION[accion]}</p>
                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                  <Campo etiqueta={max !== undefined ? `Cantidad (máx. ${max})` : "Cantidad"}>
                    <input type="number" min="1" max={max} required value={form.cantidad} onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))} className={claseCampo} />
                  </Campo>
                  <Campo etiqueta={accion === "Ingreso" ? "Origen (opcional)" : "Motivo"}>
                    <input required={accion !== "Ingreso"} maxLength={300} value={form.motivo} onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))} placeholder={accion === "Ingreso" ? "Compra 2026-2, donación…" : "Desgaste, se rompió en el entrenamiento…"} className={claseCampo} />
                  </Campo>
                </div>
              </>
            )}
            {error && <Aviso>{error}</Aviso>}
            <div className="flex gap-2">
              <button type="submit" disabled={max === 0} className={botonPrimario}>
                {accion === "prestar" ? "Registrar préstamo" : accion === "editar" ? "Guardar" : "Registrar"}
              </button>
              <button type="button" onClick={() => setAccion(null)} className={botonSecundario}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr] items-start">
        <Tarjeta titulo={`Prestados ahora (${activos.length})`}>
          {activos.length === 0 && <Vacio>Nada prestado.</Vacio>}
          <ul className="list-none m-0 p-0">
            {activos.map((p) => (
              <FilaPrestamo
                key={p.id}
                p={p}
                onDevuelto={(imp) => {
                  setI(imp);
                  setAviso("Devolución registrada.");
                }}
              />
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta titulo="Historial de movimientos" subtitulo="Quién registró cada cambio y cuándo">
          {i.movimientos.length === 0 && <Vacio>Sin movimientos.</Vacio>}
          <ol className="list-none m-0 p-0 relative">
            {i.movimientos.map((m) => (
              <li key={m.id} className="flex gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
                <span className="shrink-0 pt-0.5">
                  <Insignia tono={TONO_MOV[m.tipo] || "gris"}>{TEXTO_MOV[m.tipo] || m.tipo}</Insignia>
                </span>
                <span className="flex-1 min-w-0 leading-tight">
                  <span className="block text-sm font-semibold text-ink-900">
                    {m.cantidad} unidad{m.cantidad === 1 ? "" : "es"}
                    {m.motivo ? ` · ${m.motivo}` : ""}
                  </span>
                  <span className="block text-xs text-ink-500">
                    {new Date(m.fecha).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    {m.registradoPor ? ` · ${m.registradoPor}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </Tarjeta>
      </div>
    </main>
  );
}
