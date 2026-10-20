import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Encabezado, Insignia, Vacio } from "../../comunes/componentes/ui";
import { FotoDeporte } from "../../comunes/componentes/SelectorFoto";
import { BotonFlotante, Ventana } from "../../comunes/componentes/Ventana";
import { http } from "../../../../lib/api/http";
import { horas } from "../../comunes/lib/deporte";
import { Pastillas, textoCategorias } from "../../comunes/Pastillas";
import { CONTENEDOR } from "../../comunes/estilos";
import { TONO_ESTADO_EVENTO, respaldoEvento } from "../../comunes/eventos";
import { useCatalogosDeporte } from "../../comunes/useCatalogosDeporte";
import { EVENTO_VACIO, FormularioEvento } from "./FormularioEvento";

// Eventos deportivos (RF-002): próximos, borradores y pasados.

export function EventosDeportePage() {
  const { cat } = useCatalogosDeporte();
  const [eventos, setEventos] = useState(null);
  const [pestana, setPestana] = useState("proximos");
  const [creando, setCreando] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    http.get("/deporte/admin/eventos").then((r) => setEventos(r.data.eventos));
  }, []);
  const grupos = useMemo(() => {
    const l = eventos || [];
    return {
      proximos: l.filter((e) => !e.yaPaso && e.estado !== "Borrador" && e.estado !== "Cancelado").sort((a, b) => a.fecha.localeCompare(b.fecha)),
      borradores: l.filter((e) => e.estado === "Borrador"),
      pasados: l.filter((e) => (e.yaPaso || e.estado === "Cancelado") && e.estado !== "Borrador"),
    };
  }, [eventos]);
  const lista = grupos[pestana] || [];
  return (
    <main className={CONTENEDOR}>
      <Encabezado
        kicker="Deporte"
        titulo="Eventos deportivos"
        descripcion="Torneos, masterclasses y jornadas puntuales. Los estudiantes los ven en su área de Deporte y se inscriben; si el evento reconoce horas, quien asiste las suma."
      />
      {!creando && <BotonFlotante onClick={() => setCreando(true)}>Nuevo evento</BotonFlotante>}
      {creando && (
        <Ventana titulo="Nuevo evento" alCerrar={() => setCreando(false)}>
          <FormularioEvento cat={cat} inicial={EVENTO_VACIO} onCancelar={() => setCreando(false)} onGuardado={(e) => navigate(`/deporte/eventos/${e.id}`)} />
        </Ventana>
      )}
      <div className="mb-4">
        <Pastillas
          etiqueta="Eventos"
          opciones={[["proximos", "Próximos"], ["borradores", "Borradores"], ["pasados", "Pasados y cancelados"]]}
          valor={pestana}
          onCambio={setPestana}
          conteos={{ proximos: grupos.proximos.length, borradores: grupos.borradores.length, pasados: grupos.pasados.length }}
        />
      </div>
      {!eventos && <p className="text-ink-500">Cargando…</p>}
      {eventos && lista.length === 0 && <Vacio>No hay eventos aquí.</Vacio>}
      <ul className="list-none m-0 p-0 grid grid-cols-1 gap-3 md:grid-cols-2">
        {lista.map((e) => {
          const d = new Date(`${e.fecha}T12:00:00Z`);
          return (
            <li key={e.id}>
              <Link to={`/deporte/eventos/${e.id}`} className="h-full bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col hover:border-primary-soft hover:shadow-md transition no-underline">
                <span className="relative block">
                  <FotoDeporte url={e.imagenUrl} respaldo={respaldoEvento(e)} className="w-full h-[150px]" />
                  <span className="absolute left-3 bottom-3 w-[58px] rounded-xl bg-primary-dark/90 text-white flex flex-col items-center justify-center py-1.5 shadow" aria-hidden="true">
                    <span className="text-[10px] font-bold uppercase opacity-80">{d.toLocaleDateString("es-CO", { month: "short", timeZone: "UTC" }).replace(".", "")}</span>
                    <span className="text-[24px] leading-none font-extrabold">{d.getUTCDate()}</span>
                  </span>
                </span>
                <span className="flex-1 min-w-0 flex flex-col gap-1 p-4">
                  <span className="flex flex-wrap gap-1.5">
                    <Insignia tono={TONO_ESTADO_EVENTO[e.estado]}>{e.estado}</Insignia>
                    <Insignia tono="azul">{e.tipo}</Insignia>
                    {e.horasReconocidas ? <Insignia tono="dorado">+{horas(e.horasReconocidas)}</Insignia> : null}
                  </span>
                  <span className="font-bold text-ink-900">{e.nombre}</span>
                  <span className="text-sm text-ink-500">
                    {e.horaInicio}–{e.horaFin}
                    {e.lugar ? ` · ${e.lugar}` : ""}
                    {e.disciplina ? ` · ${e.disciplina}` : ""}
                  </span>
                  <span className="text-sm text-ink-600">
                    <strong className="tabular-nums">{e.inscritos}</strong>
                    {e.cupo ? `/${e.cupo}` : ""} inscritos · {textoCategorias(e.categorias)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
