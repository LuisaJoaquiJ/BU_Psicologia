import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Aviso, Insignia, Tarjeta, Vacio, botonDorado, botonPrimario, botonSecundario } from "../../comunes/componentes/ui";
import { useConfirmar } from "../../comunes/componentes/Confirmar";
import { Icono } from "../../comunes/componentes/Iconos";
import { FotoDeporte } from "../../comunes/componentes/SelectorFoto";
import { Ventana } from "../../comunes/componentes/Ventana";
import { http } from "../../../../lib/api/http";
import { fechaCorta, horaCorta, horas, useAhora } from "../../comunes/lib/deporte";
import { mensajeError } from "../../comunes/lib/salud";
import { textoCategorias } from "../../comunes/Pastillas";
import { IconoDisciplina } from "../../comunes/Progreso";
import { CONTENEDOR } from "../../comunes/estilos";
import { TONO_ESTADO_EVENTO, respaldoEvento } from "../../comunes/eventos";
import { useCatalogosDeporte } from "../../comunes/useCatalogosDeporte";
import { EVENTO_VACIO, FormularioEvento } from "./FormularioEvento";

// Detalle de un evento: inscritos y asistencia (solo mientras dura el evento).

export function EventoDeporteDetallePage() {
  const { id } = useParams();
  const { cat } = useCatalogosDeporte();
  const [e, setE] = useState(null);
  const [editando, setEditando] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const ahora = useAhora();
  const [presentes, setPresentes] = useState(new Set());
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const poner = (ev) => {
    setE(ev);
    setPresentes(new Set(ev.inscritosLista.filter((i) => i.asistio).map((i) => i.usuarioId)));
  };
  useEffect(() => {
    http
      .get(`/deporte/admin/eventos/${id}`)
      .then((r) => poner(r.data.evento))
      .catch((err) => setError(mensajeError(err, "No fue posible cargar el evento.")));
  }, [id]);

  const { confirmar, avisar } = useConfirmar();
  async function accion(pregunta, hacer, mensaje) {
    if (pregunta && !(await confirmar(pregunta))) return;
    setError("");
    setAviso("");
    try {
      const r = await hacer();
      poner(r.data.evento);
      setCorrigiendo(false);
      setAviso(mensaje);
      avisar(mensaje);
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar."));
    }
  }

  if (!e) return <main className={CONTENEDOR}>{error ? <Aviso>{error}</Aviso> : <p className="text-ink-500">Cargando…</p>}</main>;
  // La asistencia del evento solo se toma mientras dura: de la hora de inicio a la final.
  const enVentana = ahora >= new Date(e.asistenciaDesde).getTime() && ahora <= new Date(e.asistenciaHasta).getTime() && e.estado !== "Cancelado";
  const tomada = e.inscritosLista.some((i) => i.asistio === true || i.asistio === false);
  const asistieron = e.inscritosLista.filter((i) => i.asistio).length;
  // Ya registrada, la lista de estudiantes no se vuelve a mostrar (salvo para corregir, antes de la hora final).
  const mostrarLista = !tomada || (corrigiendo && enVentana);
  const puedeAsistencia = enVentana && (!tomada || corrigiendo);
  const textoVentana =
    e.estado === "Cancelado"
      ? "El evento está cancelado."
      : ahora < new Date(e.asistenciaDesde).getTime()
        ? `La asistencia se activa el ${fechaCorta(e.fecha)} a las ${horaCorta(e.asistenciaDesde)}, cuando empieza el evento.`
        : ahora > new Date(e.asistenciaHasta).getTime()
          ? `El evento terminó a las ${horaCorta(e.asistenciaHasta)}: la asistencia ya no se puede editar.`
          : `Marca quién asistió y guarda (puedes corregirla hasta las ${horaCorta(e.asistenciaHasta)}).${e.horasReconocidas ? " Cada asistente suma las horas del evento." : ""}`;
  return (
    <main className={`${CONTENEDOR} flex flex-col gap-6`}>
      <Link to="/deporte/eventos" className="text-sm font-bold text-primary-soft inline-flex items-center gap-1 w-fit">
        <Icono nombre="izquierda" size={16} /> Eventos
      </Link>
      <FotoDeporte url={e.imagenUrl} respaldo={respaldoEvento(e)} alt={`Foto de ${e.nombre}`} className="w-full h-[180px] sm:h-[240px] rounded-xl" />
      <div className="flex items-start gap-4 flex-wrap">
        <IconoDisciplina nombre={e.disciplina || e.tipo} tamano={56} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <Insignia tono={TONO_ESTADO_EVENTO[e.estado]}>{e.estado}</Insignia>
            <Insignia tono="azul">{e.tipo}</Insignia>
          </div>
          <h1 className="m-0 mt-1 text-[30px] font-extrabold">{e.nombre}</h1>
          <p className="m-0 mt-1 text-ink-500">
            {fechaCorta(e.fecha)} · {e.horaInicio}–{e.horaFin}
            {e.lugar ? ` · ${e.lugar}` : ""} · {textoCategorias(e.categorias)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {e.estado === "Borrador" && (
            <button type="button" onClick={() => accion({ titulo: `¿Publicar «${e.nombre}»?`, mensaje: "Los estudiantes lo verán y podrán inscribirse.", boton: "Sí, publicar" }, () => http.patch(`/deporte/admin/eventos/${e.id}`, { estado: "Publicado" }), "Evento publicado: ya lo ven los estudiantes.")} className={botonDorado}>
              Publicar
            </button>
          )}
          <button type="button" onClick={() => setEditando(true)} className={botonSecundario}>
            <Icono nombre="editar" size={15} /> Editar
          </button>
          {e.estado === "Publicado" && !e.yaPaso && (
            <button type="button" onClick={() =>
                accion(
                  { titulo: `¿Cancelar «${e.nombre}»?`, mensaje: `Los estudiantes lo verán como cancelado${e.inscritos ? ` (${e.inscritos} inscritos)` : ""} y no podrán inscribirse.`, boton: "Sí, cancelar evento", cancelar: "No, mantenerlo", peligro: true },
                  () => http.patch(`/deporte/admin/eventos/${e.id}`, { estado: "Cancelado" }),
                  "Evento cancelado."
                )
              } className={`${botonSecundario} text-red-700`}>
              Cancelar evento
            </button>
          )}
        </div>
      </div>
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      {editando && (
        <Ventana titulo="Editar evento" alCerrar={() => setEditando(false)}>
          <FormularioEvento
            cat={cat}
            inicial={{ ...EVENTO_VACIO, ...e, cupo: e.cupo ?? "", horasReconocidas: e.horasReconocidas ?? "", fechaLimite: e.fechaLimite || "", disciplinaId: e.disciplinaId || "" }}
            onCancelar={() => setEditando(false)}
            onGuardado={(ev) => {
              poner(ev);
              setEditando(false);
              setAviso("Evento actualizado.");
            }}
          />
        </Ventana>
      )}
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        {[
          ["Inscritos", e.cupo ? `${e.inscritos} / ${e.cupo}` : e.inscritos],
          ["Asistieron", tomada ? asistieron : "—"],
          ["Horas que reconoce", e.horasReconocidas ? horas(e.horasReconocidas) : "Ninguna"],
          ["Inscripciones", e.inscripcionAbierta ? "Abiertas" : "Cerradas"],
        ].map(([t, v]) => (
          <div key={t} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="m-0 text-[13px] text-ink-500">{t}</p>
            <p className="m-0 mt-1 font-display text-[26px] font-semibold text-primary tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <Tarjeta
        titulo={tomada && !mostrarLista ? "Asistencia" : "Inscritos"}
        subtitulo={textoVentana}
        acciones={
          puedeAsistencia && mostrarLista && e.inscritosLista.length > 0 ? (
            <button type="button" onClick={() =>
                accion(
                  {
                    titulo: "¿Guardar la asistencia del evento?",
                    mensaje: e.horasReconocidas ? `Cada asistente suma ${e.horasReconocidas} h de deporte.` : undefined,
                    detalle: [["Asistieron", `${presentes.size} de ${e.inscritosLista.length}`], ["No asistieron", e.inscritosLista.length - presentes.size]],
                    boton: "Sí, guardar",
                  },
                  () => http.put(`/deporte/admin/eventos/${e.id}/asistencia`, { presentes: [...presentes] }),
                  "Asistencia del evento guardada."
                )
              } className={botonPrimario}>
              Guardar asistencia ({presentes.size})
            </button>
          ) : null
        }
      >
        {tomada && !mostrarLista && (
          <div className="rounded-2xl bg-[#F1FAF7] border border-[#BFE6DA] p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-full bg-[#DDF3EA] text-[#0E6B4A] grid place-items-center">
                <Icono nombre="check" size={20} strokeWidth={2.6} />
              </span>
              <div className="leading-tight">
                <p className="m-0 font-extrabold text-ink-900">Asistencia registrada</p>
                <p className="m-0 text-sm text-ink-600">
                  {asistieron} de {e.inscritosLista.length} asistieron{e.horasReconocidas ? ` · cada uno suma ${horas(e.horasReconocidas)}` : ""}
                </p>
              </div>
            </div>
            {enVentana && (
              <button type="button" onClick={() => setCorrigiendo(true)} className={botonSecundario}>
                <Icono nombre="editar" size={15} /> Corregir hasta las {horaCorta(e.asistenciaHasta)}
              </button>
            )}
          </div>
        )}
        {mostrarLista && e.inscritosLista.length === 0 && <Vacio>Aún no hay inscritos.</Vacio>}
        {mostrarLista && (
        <ul className="list-none m-0 p-0 grid gap-2 sm:grid-cols-2">
          {e.inscritosLista.map((i) => {
            const marcado = presentes.has(i.usuarioId);
            return (
              <li key={i.usuarioId}>
                <label className={`flex items-center gap-3 rounded-xl border-[1.5px] px-3.5 py-2.5 ${puedeAsistencia ? "cursor-pointer" : ""} ${marcado ? "border-[#0d9488] bg-[#F1FAF7]" : "border-gray-200 bg-white"}`}>
                  {puedeAsistencia && (
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() =>
                        setPresentes((p) => {
                          const n = new Set(p);
                          if (n.has(i.usuarioId)) n.delete(i.usuarioId);
                          else n.add(i.usuarioId);
                          return n;
                        })
                      }
                      className="w-5 h-5 accent-[#0d9488]"
                    />
                  )}
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block font-semibold text-ink-900 truncate">{i.nombre}</span>
                    <span className="block text-xs text-ink-500 truncate">
                      {i.categoria} · {i.email}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        )}
        {corrigiendo && mostrarLista && (
          <button type="button" onClick={() => { setCorrigiendo(false); setPresentes(new Set(e.inscritosLista.filter((i) => i.asistio).map((i) => i.usuarioId))); }} className={`${botonSecundario} mt-3`}>
            Cancelar corrección
          </button>
        )}
      </Tarjeta>
    </main>
  );
}
