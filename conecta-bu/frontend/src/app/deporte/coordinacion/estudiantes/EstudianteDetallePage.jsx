import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Aviso, Insignia, Tarjeta, Vacio, botonPrimario } from "../../comunes/componentes/ui";
import { useConfirmar } from "../../comunes/componentes/Confirmar";
import { Icono } from "../../comunes/componentes/Iconos";
import { BotonFlotante, Ventana } from "../../comunes/componentes/Ventana";
import { http } from "../../../../lib/api/http";
import { fechaCorta, horas } from "../../comunes/lib/deporte";
import { descargar, mensajeError } from "../../comunes/lib/salud";
import { Pastillas } from "../../comunes/Pastillas";
import { IconoDisciplina } from "../../comunes/Progreso";
import { useCatalogosDeporte } from "../../comunes/useCatalogosDeporte";
import { FormularioHoras } from "./FormularioHoras";

// Detalle de un estudiante: horas, categoría, grupos y constancia.

export function EstudianteDetallePage() {
  const { id } = useParams();
  const { cat } = useCatalogosDeporte();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [reconociendo, setReconociendo] = useState(false);
  const { confirmar, avisar } = useConfirmar();
  const cargar = useCallback(() => http.get(`/deporte/admin/estudiantes/${id}`).then((r) => setD(r.data)), [id]);
  useEffect(() => {
    cargar().catch((err) => setError(mensajeError(err, "No fue posible cargar al estudiante.")));
  }, [cargar]);

  async function quitar(h) {
    if (!(await confirmar({ titulo: `¿Quitar ${horas(h.horas)} reconocidas?`, mensaje: `Por «${h.detalle}». El estudiante pasaría a ${horas(Math.max(0, d.total - h.horas))}.`, boton: "Sí, quitar", peligro: true }))) return;
    try {
      const r = await http.delete(`/deporte/admin/horas/${h.id}`);
      setD(r.data);
      avisar("Horas quitadas.");
    } catch (err) {
      setError(mensajeError(err, "No fue posible quitar las horas."));
    }
  }

  if (!d) return <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9">{error ? <Aviso>{error}</Aviso> : <p className="text-ink-500">Cargando…</p>}</main>;
  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-28 flex flex-col gap-6">
      {!reconociendo && <BotonFlotante onClick={() => setReconociendo(true)}>Reconocer horas</BotonFlotante>}
      {reconociendo && (
        <Ventana titulo="Reconocer horas" alCerrar={() => setReconociendo(false)} ancho="sm:max-w-[720px]">
          <FormularioHoras
            cat={cat}
            detalle={d}
            onCancelar={() => setReconociendo(false)}
            onGuardado={(nuevo) => {
              setD(nuevo);
              setReconociendo(false);
              setAviso("Horas reconocidas.");
            }}
          />
        </Ventana>
      )}
      <Link to="/deporte/estudiantes" className="text-sm font-bold text-primary-soft inline-flex items-center gap-1 w-fit">
        <Icono nombre="izquierda" size={16} /> Estudiantes
      </Link>
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <h1 className="m-0 text-[30px] font-extrabold">{d.estudiante.nombre}</h1>
          <p className="m-0 mt-1 text-ink-500">{d.estudiante.email}</p>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-ink-600">Categoría:</span>
            <Pastillas
              etiqueta="Categoría del estudiante"
              opciones={cat?.categorias || ["Pregrado", "Posgrado", "Egresado"]}
              valor={d.estudiante.categoria}
              onCambio={async (c) => {
                if (c === d.estudiante.categoria) return;
                if (!(await confirmar({ titulo: `¿Cambiar la categoría a ${c}?`, mensaje: "Define a qué disciplinas y eventos puede inscribirse. Sus inscripciones actuales se mantienen.", detalle: [["Estudiante", d.estudiante.nombre], ["Ahora", d.estudiante.categoria], ["Nueva", c]], boton: "Sí, cambiar" }))) return;
                setError("");
                try {
                  const r = await http.put(`/deporte/admin/estudiantes/${id}/categoria`, { categoria: c });
                  setD(r.data);
                  setAviso(`Categoría cambiada a ${c}. Define a qué disciplinas y eventos puede inscribirse.`);
                  avisar(`Categoría cambiada a ${c}.`);
                } catch (err) {
                  setError(mensajeError(err, "No fue posible cambiar la categoría."));
                }
              }}
            />
          </div>
        </div>
        <button type="button" onClick={() => descargar(`/deporte/admin/estudiantes/${id}/constancia`, {}, "constancia-horas-deporte.pdf")} className={botonPrimario}>
          <Icono nombre="descarga" size={17} /> Constancia
        </button>
      </div>
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex justify-between items-end gap-3 flex-wrap mb-2">
          <p className="m-0 text-ink-600">
            <strong className="font-display text-3xl text-primary">{horas(d.total)}</strong> de {d.requeridas} horas
          </p>
          {d.cumplido ? <Insignia tono="verde">Requisito cumplido</Insignia> : <Insignia tono="dorado">Faltan {horas(d.faltan)}</Insignia>}
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div className={`h-full rounded-full ${d.cumplido ? "bg-[#0d9488]" : "bg-gold"}`} style={{ width: `${d.porcentaje}%` }} />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr] items-start">
        <Tarjeta titulo="Historial de horas">
          {d.historial.length === 0 && <Vacio>Sin horas registradas.</Vacio>}
          <ul className="list-none m-0 p-0">
            {d.historial.map((h) => (
              <li key={`${h.tipo}-${h.id}`} className="flex items-center gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
                <IconoDisciplina nombre={h.disciplina} tamano={34} />
                <span className="flex-1 min-w-0 leading-tight">
                  <span className="block font-semibold text-ink-900 truncate">
                    {h.grupo || h.disciplina} {h.tipo === "reconocida" && <Insignia tono="azul">Reconocida</Insignia>}
                    {h.tipo === "evento" && <Insignia tono="dorado">Evento</Insignia>}
                  </span>
                  <span className="block text-xs text-ink-500 truncate">
                    {fechaCorta(h.fecha)} · {h.detalle}
                  </span>
                </span>
                <span className="font-bold tabular-nums">{horas(h.horas)}</span>
                {h.tipo === "reconocida" && (
                  <button type="button" onClick={() => quitar(h)} aria-label="Quitar horas reconocidas" className="w-8 h-8 rounded-full text-ink-500 hover:bg-red-50 hover:text-red-600 flex items-center justify-center">
                    <Icono nombre="cerrar" size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Tarjeta>
        <div className="flex flex-col gap-5">
          <Tarjeta titulo="Grupos">
            {d.inscripciones.length === 0 && <Vacio>Sin inscripciones.</Vacio>}
            <ul className="list-none m-0 p-0">
              {d.inscripciones.map((i) => (
                <li key={i.grupoId} className="flex justify-between gap-3 py-2 border-t border-gray-100 first:border-t-0 text-sm">
                  <Link to={`/deporte/grupos/${i.grupoId}`} className="font-semibold text-ink-900 truncate">
                    {i.grupo}
                  </Link>
                  <span className="text-ink-500 whitespace-nowrap">
                    {i.periodo} · {i.estado === "Activa" ? "Activo" : "Retirado"}
                  </span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </div>
      </div>
    </main>
  );
}
