import { useEffect, useState } from "react";
import { Aviso, Insignia, Vacio, botonPrimario, botonSecundario } from "../comunes/componentes/ui";
import { useConfirmar } from "../comunes/componentes/Confirmar";
import { Icono } from "../comunes/componentes/Iconos";
import { FotoDeporte } from "../comunes/componentes/SelectorFoto";
import { http } from "../../../lib/api/http";
import { estiloDisciplina, fechaCorta, horas } from "../comunes/lib/deporte";
import { mensajeError } from "../comunes/lib/salud";
import { Pastillas } from "../comunes/Pastillas";
import { respaldoEvento } from "../comunes/eventos";

// Eventos deportivos para el estudiante (RF-018, RF-020).

// Eventos deportivos para el estudiante (RF-018, RF-020).
export function EventosEstudiantePage() {
  const [eventos, setEventos] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(null);
  useEffect(() => {
    http
      .get("/deporte/eventos")
      .then((r) => setEventos(r.data.eventos))
      .catch(() => setError("No fue posible cargar los eventos."));
  }, []);
  const { confirmar, avisar } = useConfirmar();
  async function accion(e, tipo) {
    const ok = await confirmar(
      tipo === "inscribir"
        ? { titulo: `¿Inscribirte en ${e.nombre}?`, mensaje: e.horasReconocidas ? `Si asistes, suma ${horas(e.horasReconocidas)} a tus horas de deporte.` : undefined, detalle: [["Fecha", `${fechaCorta(e.fecha)} · ${e.horaInicio}–${e.horaFin}`], ["Lugar", e.lugar], ["Cupos libres", e.cupo ? e.cuposDisponibles : "Sin límite"]], boton: "Sí, inscribirme" }
        : { titulo: `¿Cancelar tu inscripción a ${e.nombre}?`, mensaje: "Liberas tu cupo para otra persona.", boton: "Sí, cancelar inscripción", cancelar: "No, mantenerla", peligro: true }
    );
    if (!ok) return;
    setOcupado(e.id);
    setError("");
    setAviso("");
    try {
      const r = tipo === "inscribir" ? await http.post(`/deporte/eventos/${e.id}/inscripcion`) : await http.delete(`/deporte/eventos/${e.id}/inscripcion`);
      setEventos(r.data.eventos);
      avisar(tipo === "inscribir" ? `Quedaste inscrito en ${e.nombre}.` : `Cancelaste tu inscripción a ${e.nombre}.`);
      setAviso(tipo === "inscribir" ? `Quedaste inscrito en ${e.nombre}.${e.horasReconocidas ? ` Si asistes, suma ${horas(e.horasReconocidas)} a tus horas.` : ""}` : `Cancelaste tu inscripción a ${e.nombre}.`);
    } catch (err) {
      setError(mensajeError(err, "No fue posible completar la acción."));
    } finally {
      setOcupado(null);
    }
  }
  const lista = (eventos || []).filter((e) => (filtro === "inscritos" ? e.inscrito : filtro === "horas" ? e.horasReconocidas : !e.yaPaso));
  const conteos = { todos: (eventos || []).filter((e) => !e.yaPaso).length, inscritos: (eventos || []).filter((e) => e.inscrito).length, horas: (eventos || []).filter((e) => e.horasReconocidas).length };
  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16 flex flex-col gap-5">
      <div>
        <p className="m-0 mb-1.5 text-sm font-semibold text-ink-500">Deporte</p>
        <h1 className="m-0 text-3xl sm:text-[36px] font-extrabold">Eventos deportivos</h1>
        <p className="mt-1.5 mb-0 text-ink-500 max-w-[640px]">Torneos, masterclasses y jornadas. Algunos suman horas de deporte si asistes.</p>
      </div>
      <Pastillas etiqueta="Filtrar eventos" opciones={[["todos", "Próximos"], ["inscritos", "Mis inscripciones"], ["horas", "Suman horas"]]} valor={filtro} onCambio={setFiltro} conteos={conteos} />
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      {!eventos && <p className="text-ink-500">Cargando…</p>}
      {eventos && lista.length === 0 && <Vacio>No hay eventos aquí por ahora.</Vacio>}
      <ul className="list-none m-0 p-0 grid grid-cols-1 gap-4 md:grid-cols-2">
        {lista.map((e) => {
          const d = new Date(`${e.fecha}T12:00:00Z`);
          const est = estiloDisciplina(e.disciplina || e.tipo);
          return (
            <li key={e.id} className={`bg-white border rounded-xl overflow-hidden flex flex-col ${e.inscrito ? "border-[#9ED9CB]" : "border-gray-200"}`}>
              <FotoDeporte url={e.imagenUrl} respaldo={respaldoEvento(e)} alt={`Foto de ${e.nombre}`} className="w-full h-[170px]" />
              <div className="flex gap-4 p-4" style={{ background: est.fondo }}>
                <span className="shrink-0 w-[64px] rounded-2xl bg-white flex flex-col items-center justify-center py-2" style={{ color: est.color }}>
                  <span className="text-[11px] font-bold uppercase">{d.toLocaleDateString("es-CO", { month: "short", timeZone: "UTC" }).replace(".", "")}</span>
                  <span className="text-[26px] leading-none font-extrabold">{d.getUTCDate()}</span>
                </span>
                <span className="min-w-0 flex flex-col gap-1">
                  <span className="flex gap-1.5 flex-wrap">
                    <Insignia tono="azul">{e.tipo}</Insignia>
                    {e.estado === "Cancelado" && <Insignia tono="rojo">Cancelado</Insignia>}
                    {e.horasReconocidas ? <Insignia tono="dorado">Suma {horas(e.horasReconocidas)}</Insignia> : null}
                  </span>
                  <span className="font-extrabold text-ink-900 text-lg leading-tight">{e.nombre}</span>
                  <span className="text-sm text-ink-600">
                    {e.horaInicio}–{e.horaFin}
                    {e.lugar ? ` · ${e.lugar}` : ""}
                  </span>
                </span>
              </div>
              <div className="p-4 flex flex-col gap-3 flex-1">
                {e.descripcion && <p className="m-0 text-sm text-ink-600">{e.descripcion}</p>}
                {e.cupo ? (
                  <div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-[#0d9488]" style={{ width: `${Math.min(100, (e.inscritos / e.cupo) * 100)}%` }} />
                    </div>
                    <p className="m-0 mt-1 text-xs text-ink-500">
                      {e.cuposDisponibles} de {e.cupo} cupos disponibles
                      {e.fechaLimite ? ` · inscripciones hasta el ${fechaCorta(e.fechaLimite)}` : ""}
                    </p>
                  </div>
                ) : (
                  <p className="m-0 text-xs text-ink-500">Sin límite de cupos{e.fechaLimite ? ` · inscripciones hasta el ${fechaCorta(e.fechaLimite)}` : ""}</p>
                )}
                <div className="mt-auto flex items-center justify-between gap-3 flex-wrap">
                  {e.yaPaso ? (
                    <span className="text-sm font-semibold text-ink-600">{e.asistio ? `Asististe${e.horasReconocidas ? `: +${horas(e.horasReconocidas)}` : ""}` : e.asistio === false ? "No se registró tu asistencia" : "Evento realizado"}</span>
                  ) : e.inscrito ? (
                    <>
                      <Insignia tono="verde">
                        <Icono nombre="check" size={13} strokeWidth={3} /> Inscrito
                      </Insignia>
                      <button type="button" disabled={ocupado === e.id} onClick={() => accion(e, "cancelar")} className={botonSecundario}>
                        Cancelar inscripción
                      </button>
                    </>
                  ) : e.restriccion ? (
                    <span className="text-sm font-semibold text-ink-500 inline-flex items-center gap-1.5">
                      <Icono nombre="escudo" size={15} /> {e.restriccion}
                    </span>
                  ) : (
                    <button type="button" disabled={!e.inscripcionAbierta || ocupado === e.id} onClick={() => accion(e, "inscribir")} className={botonPrimario}>
                      {e.estado === "Cancelado" ? "Cancelado" : e.inscripcionAbierta ? "Inscribirme" : e.cuposDisponibles === 0 ? "Sin cupos" : "Inscripciones cerradas"}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
