import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { http } from "../../../lib/api/http";
import { Icono } from "../comunes/componentes/Iconos";
import { Aviso, Insignia, botonPrimario, botonSecundario } from "../comunes/componentes/ui";
import { BotonesDescarga } from "../comunes/componentes/BotonesDescarga";
import { fechaLarga, formatearHora } from "../comunes/lib/format";
import { MENSAJE_EXPIRADO } from "../comunes/lib/ventanaAsistencia";

// El backend vence cada código a los 2 min. Se renueva antes para no dejar huecos.
const ROTACION_MS = 110 * 1000;
// La lista de llegadas se refresca mientras la asistencia está abierta.
const REFRESCO_LISTA_MS = 10 * 1000;
// La asistencia solo se registra entre el inicio y 30 min después del fin (lo decide el backend).
const horaBogota = (d) => new Date(d).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

// Mismo par que la agenda: Asistió (verde) y No asistió (rojo), con borde.
// El estado ya guardado se ve seleccionado (tinte lleno), no apagado.
const BOTON_MARCAR =
  "inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-full border px-3 text-sm font-bold transition-colors duration-150 disabled:cursor-not-allowed";
const marcarAsistio = (elegido, guardando) =>
  elegido
    ? `border-[#0E6B4A] bg-[#DDF3EA] text-[#0E6B4A] ${guardando ? "disabled:opacity-60" : "disabled:opacity-100"}`
    : "border-[#0E6B4A] bg-white text-[#0E6B4A] hover:bg-[#DDF3EA] disabled:opacity-60";
const marcarNoAsistio = (elegido, guardando) =>
  elegido
    ? `border-red-600 bg-red-50 text-red-700 ${guardando ? "disabled:opacity-60" : "disabled:opacity-100"}`
    : "border-red-600 bg-white text-red-700 hover:bg-red-50 disabled:opacity-60";

export function EventoInscritosPage() {
  const { id } = useParams();
  const [datos, setDatos] = useState(null);
  const [control, setControl] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cambiando, setCambiando] = useState(false);
  const [registrando, setRegistrando] = useState(null);
  const [ahora, setAhora] = useState(() => Date.now());

  const cargarInscritos = useCallback(
    () =>
      http
        .get(`/admin/eventos/${id}/inscripciones`)
        .then((res) => setDatos(res.data))
        .catch((err) => setError(err.response?.data?.message || "No fue posible cargar los inscritos.")),
    [id],
  );

  const cargarControl = useCallback(
    () =>
      http
        .get(`/admin/eventos/${id}/asistencia`)
        .then((res) => setControl(res.data))
        .catch((err) => setError(err.response?.data?.message || "No fue posible cargar la asistencia.")),
    [id],
  );

  useEffect(() => {
    cargarInscritos();
    cargarControl();
  }, [cargarInscritos, cargarControl]);

  // Mantiene al día el estado de la ventana de asistencia.
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ventana = control?.ventana;
  const estadoVentana = !ventana
    ? null
    : ahora < new Date(ventana.inicio).getTime()
      ? "antes"
      : ahora >= new Date(ventana.limite).getTime()
        ? "expirada"
        : "abierta";
  const enVentana = estadoVentana === "abierta";
  const mensajeVentana =
    estadoVentana === "antes"
      ? `La asistencia se habilita cuando empiece el evento (${horaBogota(ventana.inicio)}).`
      : estadoVentana === "expirada"
        ? MENSAJE_EXPIRADO
        : "";
  const abierta = Boolean(control?.abierta) && estadoVentana !== "expirada";

  // Renueva el código del QR mientras la asistencia esté abierta.
  useEffect(() => {
    if (!abierta) return undefined;
    const rotar = setInterval(() => {
      http
        .post(`/admin/eventos/${id}/asistencia/rotar`)
        .then((res) => setControl(res.data))
        .catch((err) => {
          setError(err.response?.data?.message || "No se pudo renovar el código del QR. Revisa la conexión.");
          cargarControl();
        });
    }, ROTACION_MS);
    return () => clearInterval(rotar);
  }, [abierta, id, cargarControl]);

  // Refresca la lista de llegadas y el contador de segundos.
  useEffect(() => {
    if (!abierta) return undefined;
    const refresco = setInterval(cargarInscritos, REFRESCO_LISTA_MS);
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => {
      clearInterval(refresco);
      clearInterval(reloj);
    };
  }, [abierta, cargarInscritos]);

  async function cambiarAsistencia(nuevaAbierta) {
    setError("");
    setAviso("");
    setCambiando(true);
    try {
      const res = await http.patch(`/admin/eventos/${id}/asistencia`, { abierta: nuevaAbierta });
      setControl(res.data);
      setAviso(nuevaAbierta ? "Asistencia abierta. Muestra el QR a los estudiantes." : "Asistencia cerrada. El QR ya no funciona.");
      await cargarInscritos();
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible cambiar la asistencia.");
    } finally {
      setCambiando(false);
    }
  }

  async function marcar(inscripcionId, asistio) {
    setError("");
    setRegistrando(inscripcionId);
    try {
      await http.patch(`/admin/eventos/${id}/inscripciones/${inscripcionId}/asistencia`, { asistio });
      await cargarInscritos();
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible registrar la asistencia.");
    } finally {
      setRegistrando(null);
    }
  }

  const evento = datos?.evento;
  const inscripciones = datos?.inscripciones || [];
  const asistieron = inscripciones.filter((i) => i.asistencia?.asistio === true).length;
  const noAsistieron = inscripciones.filter((i) => i.asistencia?.asistio === false).length;
  const pendientes = inscripciones.length - asistieron - noAsistieron;
  const eventoCancelado = evento?.estado === "Cancelado";
  const estadoPermite = evento && ["Publicado", "Cerrado"].includes(evento.estado);
  const puedeAbrir = estadoPermite && enVentana;
  const puedeMarcar = estadoPermite;
  const segundos = control?.codigoExpira ? Math.max(0, Math.ceil((new Date(control.codigoExpira) - ahora) / 1000)) : 0;
  const urlQr = control?.codigo ? `${window.location.origin}/asistencia/${control.codigo}` : "";

  return (
    <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-24">
      <Link to="/admin/eventos" className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-bold text-primary hover:underline underline-offset-4">
        <Icono nombre="izquierda" size={17} strokeWidth={2.2} />
        Volver a eventos
      </Link>

      {error && (
        <div className="my-5">
          <Aviso>{error}</Aviso>
        </div>
      )}
      {aviso && (
        <div className="my-5" role="status">
          <Aviso tono="verde">{aviso}</Aviso>
        </div>
      )}
      {!datos && !error && <p className="text-ink-500 mt-6">Cargando inscritos…</p>}

      {evento && (
        <>
          <header className="mt-4 mb-7">
            <p className="m-0 mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">Desarrollo Humano · Asistencia</p>
            <h1 className="m-0 text-[30px] sm:text-[38px] leading-tight font-extrabold text-ink-900">{evento.nombre}</h1>
            <p className="mt-2 mb-0 text-ink-500">
              {fechaLarga(evento.fecha)} · {formatearHora(evento.horaInicio)} a {formatearHora(evento.horaFin)}
              {evento.lugar ? ` · ${evento.lugar}` : ""} · {evento.estado}
            </p>
          </header>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              ["Inscritos", inscripciones.length],
              ["Cupos", evento.cupos],
              ["Asistieron", asistieron],
              ["Pendientes", pendientes],
            ].map(([titulo, n]) => (
              <div key={titulo} className="rounded-2xl bg-white border border-gray-200 shadow-sm px-5 py-4">
                <p className="m-0 text-xs font-bold uppercase tracking-wide text-ink-500">{titulo}</p>
                <p className="m-0 mt-1 text-3xl font-extrabold text-ink-900 tabular-nums">{n}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-start">
            {/* Bloque de asistencia por QR */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col items-center gap-5 text-center lg:sticky lg:top-4">
              <div className="w-full">
                <h2 className="m-0 text-lg font-extrabold text-ink-900">Asistencia por QR</h2>
                <p className="m-0 mt-1 text-sm text-ink-500">
                  {abierta ? "Los estudiantes inscritos escanean el código para registrar su llegada." : "Abre la asistencia cuando empiece el evento."}
                </p>
              </div>

              {abierta ? (
                <>
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <QRCodeSVG value={urlQr} size={220} level="M" includeMargin />
                  </div>
                  <p className="m-0 text-sm font-semibold text-ink-600 tabular-nums">
                    El código se renueva en <span className="font-extrabold text-ink-900">{segundos}</span> s
                  </p>
                </>
              ) : (
                <div className="w-full h-[220px] rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center text-sm text-ink-500">
                  Asistencia cerrada
                </div>
              )}

              <button
                type="button"
                onClick={() => cambiarAsistencia(!abierta)}
                disabled={cambiando || (!abierta && (!puedeAbrir || eventoCancelado))}
                className={abierta ? botonSecundario : botonPrimario}
              >
                {cambiando ? "Guardando…" : abierta ? "Cerrar asistencia" : "Abrir asistencia"}
              </button>
              {!abierta && !estadoPermite && (
                <p className="m-0 text-xs text-ink-500">Solo se puede abrir la asistencia de un evento publicado o cerrado.</p>
              )}
              {estadoPermite && !eventoCancelado && mensajeVentana && (
                <p className="m-0 text-sm font-semibold text-red-700" role="status">{mensajeVentana}</p>
              )}
              {estadoPermite && enVentana && (
                <p className="m-0 text-xs text-ink-500">Se puede registrar asistencia hasta las {horaBogota(ventana.limite)}.</p>
              )}
            </section>

            {/* Lista de inscritos */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
                <h2 className="m-0 text-base font-extrabold text-ink-900">Inscritos</h2>
                <div className="flex flex-wrap items-center gap-3">
                  {abierta && <span className="text-xs font-bold text-[#0B6B61]">Actualizando en vivo</span>}
                  <BotonesDescarga url={`/admin/eventos/${id}/inscripciones/exportar`} nombre={`asistentes-evento-${id}`} onError={setError} />
                </div>
              </div>

              {inscripciones.length === 0 ? (
                <p className="m-0 px-5 py-10 text-center text-ink-500">Este evento todavía no tiene inscritos.</p>
              ) : (
                <ul className="list-none m-0 p-0 divide-y divide-gray-100">
                  {inscripciones.map((i) => {
                    const asistio = i.asistencia?.asistio;
                    return (
                      <li key={i.id} className="px-5 py-3.5 flex items-center justify-between flex-wrap gap-3">
                        <div className="min-w-0">
                          <p className="m-0 font-bold text-ink-900 truncate">{i.usuario?.nombre}</p>
                          <p className="m-0 text-xs text-ink-500 truncate">{i.usuario?.emailInstitucional}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Insignia tono={asistio === true ? "verde" : asistio === false ? "rojo" : "gris"}>
                            {asistio === true ? "Asistió" : asistio === false ? "No asistió" : "Sin registrar"}
                          </Insignia>
                          {puedeMarcar && (
                            <>
                              <button
                                type="button"
                                onClick={() => marcar(i.id, true)}
                                aria-pressed={asistio === true}
                                disabled={!enVentana || registrando === i.id || asistio === true}
                                title={mensajeVentana || undefined}
                                className={`${BOTON_MARCAR} ${marcarAsistio(asistio === true, registrando === i.id)}`}
                              >
                                <Icono nombre="check" size={16} strokeWidth={2.4} /> Asistió
                              </button>
                              <button
                                type="button"
                                onClick={() => marcar(i.id, false)}
                                aria-pressed={asistio === false}
                                disabled={!enVentana || registrando === i.id || asistio === false}
                                title={mensajeVentana || undefined}
                                className={`${BOTON_MARCAR} ${marcarNoAsistio(asistio === false, registrando === i.id)}`}
                              >
                                <Icono nombre="cerrar" size={16} strokeWidth={2.4} /> No asistió
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}