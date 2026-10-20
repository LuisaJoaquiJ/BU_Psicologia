import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Aviso, Insignia, Tarjeta, Vacio } from "../comunes/componentes/ui";
import { Icono } from "../comunes/componentes/Iconos";
import { FotoDeporte } from "../comunes/componentes/SelectorFoto";
import { BandaInicio, botonBandaPrincipal, botonBandaSecundario, hoyLargo } from "../comunes/componentes/ui";
import { http } from "../../../lib/api/http";
import { useAuth } from "../../../lib/auth/AuthContext";
import { fechaCorta, horas } from "../comunes/lib/deporte";
import { AnilloHoras, BarrasDisciplina, IconoDisciplina } from "../comunes/Progreso";
import { respaldoEvento } from "../comunes/eventos";
import { Avisos } from "./Avisos";
import { MiSemana } from "./MiSemana";
import { descargarConstancia, useMisHoras } from "./useMisHoras";

// Inicio del estudiante: avance, semana, eventos y últimas horas.

export function InicioDeporte() {
  const { usuario } = useAuth();
  const { datos, error } = useMisHoras();
  const [eventos, setEventos] = useState([]);
  useEffect(() => {
    http
      .get("/deporte/eventos")
      .then((r) => setEventos(r.data.eventos))
      .catch(() => {});
  }, []);
  const proximos = eventos.filter((e) => !e.yaPaso && (e.inscrito || (e.inscripcionAbierta && !e.restriccion))).slice(0, 3);
  return (
    <>
      <BandaInicio
        titulo={
          datos?.cumplido ? (
            <>
              ¡Completaste tus horas, <span className="text-cyan">{usuario?.nombre?.split(" ")[0]}!</span>
            </>
          ) : (
            <>
              Hola, <span className="text-cyan">{usuario?.nombre?.split(" ")[0]}.</span>
            </>
          )
        }
        fecha={`${hoyLargo()}${datos?.periodo ? ` · Periodo ${datos.periodo}` : ""}`}
        texto={
          datos
            ? datos.cumplido
              ? `Registras ${horas(datos.total)} de práctica deportiva. Descarga tu constancia cuando la necesites.`
              : `Te faltan ${horas(datos.faltan)} para completar las ${datos.requeridas} horas de deporte. Este periodo llevas ${horas(datos.horasPeriodo)}.`
            : "Cargando tu avance…"
        }
        acciones={
          <>
            <Link to="/mi-deporte/oferta" className={botonBandaPrincipal}>
              <Icono nombre="balon" size={18} /> Ver disciplinas e inscribirme
            </Link>
            <button type="button" onClick={descargarConstancia} className={botonBandaSecundario}>
              <Icono nombre="descarga" size={17} /> Constancia
            </button>
          </>
        }
        lado={datos ? <AnilloHoras total={datos.total} requeridas={datos.requeridas} /> : <div className="w-[168px] h-[168px] rounded-full bg-white/10 animate-pulse" />}
      />
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16 flex flex-col gap-6">

      {error && <Aviso>{error}</Aviso>}
      <Avisos />

      <Tarjeta titulo="Mi semana" subtitulo={datos?.grupos?.length ? `${datos.grupos.length} grupo(s) este periodo · tus eventos aparecen en naranja` : null}>
        {datos && datos.grupos.length === 0 ? (
          <Vacio>
            Aún no estás inscrito en ningún grupo este periodo.{" "}
            <Link to="/mi-deporte/oferta" className="font-bold text-primary-soft">
              Mira la oferta
            </Link>
            .
          </Vacio>
        ) : (
          datos && <MiSemana grupos={datos.grupos} eventos={eventos} />
        )}
      </Tarjeta>

      {proximos.length > 0 && (
        <Tarjeta
          titulo="Próximos eventos"
          acciones={
            <Link to="/mi-deporte/eventos" className="text-sm font-bold text-primary-soft">
              Ver eventos →
            </Link>
          }
        >
          <ul className="list-none m-0 p-0 grid gap-3 md:grid-cols-3">
            {proximos.map((e) => (
              <li key={e.id} className="rounded-2xl border border-gray-200 overflow-hidden flex flex-col gap-1 pb-3">
                <FotoDeporte url={e.imagenUrl} respaldo={respaldoEvento(e)} className="w-full h-[110px] mb-1" />
                <span className="px-3 text-xs font-bold text-[#8A4B00]">
                  {fechaCorta(e.fecha)} · {e.horaInicio}
                </span>
                <span className="px-3 font-bold text-ink-900">{e.nombre}</span>
                <span className="px-3 text-xs text-ink-500">
                  {e.tipo}
                  {e.horasReconocidas ? ` · suma ${horas(e.horasReconocidas)}` : ""}
                </span>
                {e.inscrito && (
                  <Insignia tono="verde" className="self-start ml-3">
                    Inscrito
                  </Insignia>
                )}
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta titulo="Horas por disciplina">
          {datos?.porDisciplina?.length ? <BarrasDisciplina datos={datos.porDisciplina} /> : <Vacio>Tus horas aparecerán cuando el instructor registre tu asistencia.</Vacio>}
        </Tarjeta>
        <Tarjeta
          titulo="Últimas horas registradas"
          acciones={
            <Link to="/mi-deporte/horas" className="text-sm font-bold text-primary-soft">
              Ver todo →
            </Link>
          }
        >
          {datos?.historial?.length === 0 && <Vacio>Sin registros todavía.</Vacio>}
          <ul className="list-none m-0 p-0">
            {datos?.historial?.slice(0, 6).map((h) => (
              <li key={`${h.tipo}-${h.id}`} className="flex items-center gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
                <IconoDisciplina nombre={h.disciplina} tamano={36} />
                <span className="flex-1 min-w-0 leading-tight">
                  <span className="block font-semibold text-ink-900 truncate">{h.grupo || h.disciplina}</span>
                  <span className="block text-xs text-ink-500 truncate">
                    {fechaCorta(h.fecha)} · {h.detalle}
                  </span>
                </span>
                <span className="font-bold text-primary tabular-nums">+{horas(h.horas)}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
    </main>
    </>
  );
}
