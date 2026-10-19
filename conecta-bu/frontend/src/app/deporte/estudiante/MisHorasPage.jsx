import { Aviso, Insignia, Tarjeta, Vacio, botonPrimario } from "../comunes/componentes/ui";
import { Icono } from "../comunes/componentes/Iconos";
import { fechaCorta, horas } from "../comunes/lib/deporte";
import { descargarConstancia, useMisHoras } from "./useMisHoras";

// Historial de horas del estudiante.

export function MisHorasPage() {
  const { datos, error } = useMisHoras();
  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16 flex flex-col gap-6">
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <p className="m-0 mb-1.5 text-sm font-semibold text-ink-500">Deporte</p>
          <h1 className="m-0 text-3xl sm:text-[36px] font-extrabold">Mis horas</h1>
        </div>
        <button type="button" onClick={descargarConstancia} className={botonPrimario}>
          <Icono nombre="descarga" size={17} /> Descargar constancia
        </button>
      </div>
      {error && <Aviso>{error}</Aviso>}
      {datos && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex justify-between items-end gap-3 flex-wrap mb-2">
              <p className="m-0 text-ink-600">
                <strong className="font-display text-3xl text-primary">{horas(datos.total)}</strong> de {datos.requeridas} horas requeridas
              </p>
              {datos.cumplido ? <Insignia tono="verde">Requisito cumplido</Insignia> : <Insignia tono="dorado">Faltan {horas(datos.faltan)}</Insignia>}
            </div>
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-gold" style={{ width: `${datos.porcentaje}%` }} />
            </div>
            <div className="flex gap-2 flex-wrap mt-4">
              {datos.porPeriodo.map((p) => (
                <span key={p.periodo} className="text-sm bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
                  {p.periodo}: <strong>{horas(p.horas)}</strong>
                </span>
              ))}
            </div>
          </div>
          <Tarjeta titulo="Historial" subtitulo="Asistencias registradas por los instructores y horas reconocidas por Bienestar">
            {datos.historial.length === 0 ? (
              <Vacio>Aún no tienes horas registradas.</Vacio>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[560px]">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.06em] text-ink-500 bg-gray-50">
                      <th className="px-3 py-2.5">Fecha</th>
                      <th className="px-3 py-2.5">Disciplina</th>
                      <th className="px-3 py-2.5">Detalle</th>
                      <th className="px-3 py-2.5 text-right">Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.historial.map((h) => (
                      <tr key={`${h.tipo}-${h.id}`} className="border-t border-gray-100">
                        <td className="px-3 py-2.5 whitespace-nowrap">{fechaCorta(h.fecha)}</td>
                        <td className="px-3 py-2.5">
                          <span className="font-semibold">{h.disciplina}</span>
                          {h.grupo && <span className="block text-xs text-ink-500">{h.grupo}</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {h.tipo === "reconocida" && (
                            <Insignia tono="azul" className="mr-1.5">
                              Reconocida
                            </Insignia>
                          )}
                          {h.tipo === "evento" && (
                            <Insignia tono="dorado" className="mr-1.5">
                              Evento
                            </Insignia>
                          )}
                          {h.detalle}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums">{horas(h.horas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>
        </>
      )}
    </main>
  );
}
