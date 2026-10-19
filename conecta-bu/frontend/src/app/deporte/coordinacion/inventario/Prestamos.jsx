import { useState } from "react";
import { Aviso, Campo, Insignia, botonPrimario, botonSecundario, claseCampo } from "../../comunes/componentes/ui";
import { useConfirmar } from "../../comunes/componentes/Confirmar";
import { http } from "../../../../lib/api/http";
import { fechaCorta } from "../../comunes/lib/deporte";
import { mensajeError } from "../../comunes/lib/salud";

// Préstamos de implementos: fila del préstamo y formulario de devolución.

export function FormularioDevolucion({ prestamo, onListo, onCancelar }) {
  const [d, setD] = useState({ danados: 0, perdidos: 0, observacion: "" });
  const [error, setError] = useState("");
  const bien = prestamo.cantidad - Number(d.danados || 0) - Number(d.perdidos || 0);
  const { confirmar, avisar } = useConfirmar();
  async function guardar(e) {
    e.preventDefault();
    setError("");
    const problemas = Number(d.danados || 0) + Number(d.perdidos || 0);
    if (
      !(await confirmar({
        titulo: "¿Registrar la devolución?",
        mensaje: problemas ? "Los dañados pasan a «dañados» y los perdidos salen del inventario." : "Todo vuelve a estar disponible.",
        detalle: [["Responsable", prestamo.responsable], ["En buen estado", bien], ["Dañados", Number(d.danados || 0)], ["Perdidos", Number(d.perdidos || 0)]],
        boton: "Sí, registrar",
        peligro: Number(d.perdidos || 0) > 0,
      }))
    )
      return;
    try {
      const r = await http.post(`/deporte/admin/prestamos/${prestamo.id}/devolucion`, { devueltosDanados: Number(d.danados || 0), perdidos: Number(d.perdidos || 0), observacion: d.observacion });
      avisar(`Devolución registrada: ${prestamo.responsable}.`);
      onListo(r.data.implemento);
    } catch (err) {
      setError(mensajeError(err, "No fue posible registrar la devolución."));
    }
  }
  return (
    <form onSubmit={guardar} className="mt-3 rounded-xl bg-gray-50 border border-gray-200 p-3 flex flex-col gap-3">
      <div className="grid gap-3 grid-cols-3">
        <div>
          <p className="m-0 text-xs font-semibold text-ink-600">En buen estado</p>
          <p className={`m-0 mt-1 text-2xl font-extrabold tabular-nums ${bien < 0 ? "text-red-700" : "text-[#0B6B61]"}`}>{bien}</p>
        </div>
        <Campo etiqueta="Dañados">
          <input type="number" min="0" max={prestamo.cantidad} value={d.danados} onChange={(e) => setD((x) => ({ ...x, danados: e.target.value }))} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Perdidos">
          <input type="number" min="0" max={prestamo.cantidad} value={d.perdidos} onChange={(e) => setD((x) => ({ ...x, perdidos: e.target.value }))} className={claseCampo} />
        </Campo>
      </div>
      {(Number(d.danados) > 0 || Number(d.perdidos) > 0) && (
        <Campo etiqueta="¿Qué pasó?">
          <input required maxLength={300} value={d.observacion} onChange={(e) => setD((x) => ({ ...x, observacion: e.target.value }))} placeholder="Se pinchó durante el partido…" className={claseCampo} />
        </Campo>
      )}
      {error && <Aviso>{error}</Aviso>}
      <div className="flex gap-2">
        <button type="submit" disabled={bien < 0} className={`${botonPrimario} min-h-[38px]`}>
          Registrar devolución
        </button>
        <button type="button" onClick={onCancelar} className={`${botonSecundario} min-h-[38px]`}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function FilaPrestamo({ p, onDevuelto, mostrarImplemento }) {
  const [devolviendo, setDevolviendo] = useState(false);
  return (
    <li className={`py-3 border-t border-gray-100 first:border-t-0 ${p.vencido ? "bg-red-50/60 -mx-3 px-3 rounded-xl" : ""}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex-1 min-w-[200px] leading-tight">
          <span className="block font-semibold text-ink-900">
            {mostrarImplemento ? `${p.cantidad} × ${p.implemento}` : `${p.cantidad} unidad${p.cantidad === 1 ? "" : "es"}`} → {p.responsable}
          </span>
          <span className="block text-xs text-ink-500">
            {p.tipoResponsable} · prestado el {fechaCorta(new Date(p.fechaPrestamo).toISOString())} · devolver el {fechaCorta(p.fechaDevolucionEsperada)}
            {p.responsableEmail ? ` · ${p.responsableEmail}` : ""}
          </span>
        </span>
        {p.vencido ? <Insignia tono="rojo">Vencido</Insignia> : p.diasRestantes === 0 ? <Insignia tono="dorado">Vence hoy</Insignia> : null}
        {!devolviendo && (
          <button type="button" onClick={() => setDevolviendo(true)} className={`${botonSecundario} min-h-[36px] text-[13px]`}>
            Registrar devolución
          </button>
        )}
      </div>
      {devolviendo && (
        <FormularioDevolucion
          prestamo={p}
          onCancelar={() => setDevolviendo(false)}
          onListo={(imp) => {
            setDevolviendo(false);
            onDevuelto(imp);
          }}
        />
      )}
    </li>
  );
}
