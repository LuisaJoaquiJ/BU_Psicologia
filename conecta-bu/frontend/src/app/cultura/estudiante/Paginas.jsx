import { AvisoFlotante } from "../../../components/avisos/Avisos";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { horarioTexto, hoyISO, mensajeError } from "../comun/formato";
import { useAuth } from "../../../lib/auth/AuthContext";
import { IMAGENES, urlDelServidor } from "../../../lib/imagenes";
import { Icono } from "../comunes/componentes/Iconos";
import { BandaInicio, Campo, EstadoVacio, Esqueleto, Insignia, Tarjeta, Vacio, botonBandaPrincipal, botonBandaSecundario, botonPrimario, claseCampo, hoyLargo } from "../comunes/componentes/ui";

function Aviso({ tono = "rojo", children }) {
  return <AvisoFlotante tono={tono === "verde" ? "exito" : "error"}>{children}</AvisoFlotante>;
}

function Marco({ titulo, texto, children }) {
  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 lg:pt-10 pb-16">
      <h1 className="m-0 font-sans text-[32px] sm:text-[40px] leading-[1.05] tracking-[-0.035em] font-extrabold text-primary-dark">{titulo}</h1>
      {texto && <p className="mt-2 mb-6 text-ink-500 max-w-2xl">{texto}</p>}
      {children}
    </main>
  );
}

// Registro de asistencia con la ubicacion: la persona esta en el sitio de la
// sesion o del evento y pulsa "Estoy aqui". Va en la banda, al lado del saludo.
const ERRORES_UBICACION = {
  1: "Permite el acceso a tu ubicación en el navegador para poder marcar tu asistencia.",
  2: "No pudimos saber dónde estás. Activa el GPS e inténtalo de nuevo.",
  3: "Tardamos demasiado en ubicarte. Sal a un lugar abierto e inténtalo de nuevo.",
};
function RegistrarAsistencia() {
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState("");
  const [buscando, setBuscando] = useState(false);
  function marcar() {
    setError("");
    setHecho("");
    if (!navigator.geolocation) {
      setError("Este navegador no permite usar la ubicación. Prueba con otro o avisa al docente.");
      return;
    }
    setBuscando(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { data } = await http.post("/cultura/asistencia/ubicacion", {
            latitud: pos.coords.latitude,
            longitud: pos.coords.longitude,
            precision: pos.coords.accuracy,
          });
          setHecho(`Quedó tu asistencia en ${data.actividad}.`);
        } catch (err) {
          setError(mensajeError(err, "No fue posible registrar tu asistencia."));
        } finally {
          setBuscando(false);
        }
      },
      (err) => {
        setError(ERRORES_UBICACION[err.code] || "No pudimos obtener tu ubicación.");
        setBuscando(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }
  return (
    <div className="w-[min(340px,calc(100vw-5rem))] rounded-[24px] bg-white/[0.08] border border-white/20 backdrop-blur-md p-6 flex flex-col gap-3 shadow-[0_24px_50px_-20px_rgba(2,10,28,0.6)]">
      <span aria-hidden="true" className="w-11 h-11 rounded-2xl bg-white/15 grid place-items-center text-white">
        <Icono nombre="check" size={22} strokeWidth={2.4} />
      </span>
      <h2 className="m-0 text-[19px] font-extrabold text-white">¿Estás en una sesión?</h2>
      <p className="m-0 text-sm leading-relaxed text-[#E4DCF7]">Marca tu asistencia con tu ubicación. Tienes que estar en el sitio y dentro del horario.</p>
      <button type="button" onClick={marcar} disabled={buscando} aria-describedby="estado-asistencia" className="min-h-[48px] px-5 rounded-full bg-[#C9B8FF] text-[#1F1147] font-extrabold transition-transform duration-150 active:scale-[0.97] hover:bg-[#D9CCFF] disabled:opacity-60">
        {buscando ? "Buscando tu ubicación…" : "Estoy aquí"}
      </button>
      <p id="estado-asistencia" role="status" className={`m-0 min-h-[20px] text-sm font-semibold ${error ? "text-[#FFC2C2]" : "text-[#B9F5D8]"}`}>
        {error || hecho}
      </p>
    </div>
  );
}

const TIPOS_PERSONA = [
  { codigo: 1, nombre: "Estudiante" },
  { codigo: 2, nombre: "Docente" },
  { codigo: 3, nombre: "Administrativo" },
  { codigo: 4, nombre: "Egresado" },
];
const diaDeHoy = () => ((new Date(`${hoyISO()}T12:00:00`).getDay() + 6) % 7) + 1;
const fechaLarga = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
const fechaEvento = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
const FOTO_TIPO = { especial: IMAGENES.auditorio, representativo: IMAGENES.integracion, promocion: IMAGENES.sede, taller: IMAGENES.permanencia, itinerante: IMAGENES.salud };
const fotoEvento = (e) => (e.imagenUrl ? urlDelServidor(e.imagenUrl) : (FOTO_TIPO[e.categoriaId] || IMAGENES.auditorio).src);
const ESTADO_POSTULACION = { Recibida: ["dorado", "En revisión"], Citada: ["azul", "Citado a audición"], Aceptada: ["verde", "Aceptada"], Rechazada: ["gris", "No seleccionada"] };

// Avance de una postulacion: enviada -> audicion (o entrevista) -> decision.
function ProgresoPostulacion({ postulacion: p }) {
  const rechazada = p.estado === "Rechazada";
  const aceptada = p.estado === "Aceptada";
  const citada = p.estado === "Citada";
  const decidida = aceptada || rechazada;
  const pasos = [
    { titulo: "Postulación enviada", detalle: `El ${fechaEvento(p.fecha)}`, estado: "hecho" },
    {
      titulo: "Audición",
      detalle: p.audicion ? `${fechaLarga(p.audicion.fecha)} · ${p.audicion.hora} · ${p.audicion.lugar}` : "Te avisaremos el día, la hora y el lugar",
      estado: decidida ? "hecho" : "actual",
    },
    {
      titulo: aceptada ? "Aceptada" : rechazada ? "No seleccionada" : "Decisión",
      detalle: aceptada ? "Ya eres parte del grupo" : rechazada ? "Gracias por participar" : "La define quien dirige el grupo tras la audición",
      estado: decidida ? (rechazada ? "cerrado" : "hecho") : "pendiente",
    },
  ];
  const marca = { hecho: "bg-primary text-white", actual: "bg-white text-primary ring-2 ring-primary", pendiente: "bg-white text-ink-500 ring-1 ring-gray-300", cerrado: "bg-gray-300 text-white" };
  return (
    <div className="mt-4">
      <ol className="list-none m-0 p-0 grid gap-3 sm:grid-cols-3" aria-label="Avance de tu postulación">
        {pasos.map((paso, i) => (
          <li key={paso.titulo} className="flex sm:flex-col gap-3 sm:gap-2">
            <span className={`shrink-0 w-8 h-8 rounded-full grid place-items-center text-sm font-extrabold ${marca[paso.estado]}`} aria-hidden="true">
              {paso.estado === "hecho" ? "✓" : i + 1}
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-extrabold ${paso.estado === "pendiente" ? "text-ink-500" : "text-primary-dark"}`}>{paso.titulo}</span>
              <span className="block text-[13px] text-ink-600 first-letter:uppercase">{paso.detalle}</span>
            </span>
          </li>
        ))}
      </ol>
      {p.observacion && decidida && <p className="mt-3 mb-0 text-sm rounded-xl bg-primary-light/60 px-4 py-3 text-ink-700">Comentario del área: {p.observacion}</p>}
      {citada && <p className="mt-3 mb-0 text-sm font-semibold text-primary">Llega unos minutos antes. Si no puedes asistir, avisa al área.</p>}
    </div>
  );
}
const enlaceTarjeta = "inline-flex items-center min-h-[44px] px-3 -mr-3 rounded-full text-sm font-bold text-primary hover:bg-primary-light no-underline";

// Datos que la universidad reporta al Ministerio (SNIES y registro calificado).
function MisDatos({ perfil, alGuardar }) {
  const [guardando, setGuardando] = useState(false);
  const [estado, setEstado] = useState({ tono: "", texto: "" });
  const incompleto = perfil && (!perfil.programa || !perfil.documento);
  const [editando, setEditando] = useState(false);
  async function guardar(e) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setGuardando(true);
    setEstado({ tono: "", texto: "" });
    try {
      const r = await http.put("/cultura/perfil", {
        tipoSnies: Number(datos.get("tipoSnies")),
        documento: datos.get("documento"),
        programa: datos.get("programa"),
        caracterizacion: datos.get("caracterizacion"),
      });
      alGuardar(r.data);
      setEstado({ tono: "ok", texto: "Tus datos quedaron guardados." });
      setEditando(false);
    } catch (err) {
      setEstado({ tono: "error", texto: mensajeError(err, "No fue posible guardar tus datos.") });
    } finally {
      setGuardando(false);
    }
  }
  // Con los datos completos basta un resumen; el formulario se abre solo al editar.
  if (perfil && !incompleto && !editando) {
    const tipo = (perfil.tipos || TIPOS_PERSONA).find((t) => t.codigo === perfil.tipoSnies)?.nombre;
    return (
      <div className="vidrio-panel rounded-[20px] px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm text-ink-600 min-w-0">
          <span className="font-extrabold text-primary-dark">Tus datos para los informes están completos.</span>{" "}
          {[tipo, perfil.programa].filter(Boolean).join(" · ")}
        </p>
        <button type="button" onClick={() => setEditando(true)} className={enlaceTarjeta}>
          Editar
        </button>
      </div>
    );
  }
  return (
    <Tarjeta titulo="Tus datos para los informes" subtitulo="Bienestar reporta tu participación al Ministerio de Educación. Con estos datos tu asistencia cuenta bien.">
      {incompleto && (
        <p className="m-0 mb-4 text-sm rounded-xl bg-gold-light text-[#5C4206] px-4 py-3">Te falta tu cédula o tu programa. Complétalos para que tu participación cuente en los informes.</p>
      )}
      <form key={`${perfil?.tipoSnies}-${perfil?.documento}-${perfil?.programa}-${perfil?.caracterizacion}`} onSubmit={guardar} className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Participas como">
          <select name="tipoSnies" defaultValue={perfil?.tipoSnies || 1} className={claseCampo}>
            {(perfil?.tipos || TIPOS_PERSONA).map((t) => (
              <option key={t.codigo} value={t.codigo}>
                {t.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Cédula">
          <input name="documento" inputMode="numeric" autoComplete="off" defaultValue={perfil?.documento || ""} placeholder="1061234567" className={claseCampo} />
        </Campo>
        <Campo etiqueta="Programa académico">
          <input name="programa" defaultValue={perfil?.programa || ""} placeholder="Derecho" className={claseCampo} />
        </Campo>
        <Campo etiqueta="Autorreconocimiento étnico" ayuda="Opcional. En los informes solo aparece como total.">
          <select name="caracterizacion" defaultValue={perfil?.caracterizacion || "No registra"} className={claseCampo}>
            {(perfil?.caracterizaciones || ["No registra"]).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Campo>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <button disabled={guardando} className={`${botonPrimario} disabled:opacity-60`}>
            {guardando ? "Guardando…" : "Guardar mis datos"}
          </button>
          <p role="status" className={`m-0 text-sm font-semibold ${estado.tono === "error" ? "text-red-700" : "text-[#0B6B61]"}`}>
            {estado.texto}
          </p>
        </div>
      </form>
    </Tarjeta>
  );
}

export function InicioCultura() {
  const { usuario } = useAuth();
  const [oferta, setOferta] = useState(null);
  const [agenda, setAgenda] = useState(null);
  const [convocatorias, setConvocatorias] = useState([]);
  const [perfil, setPerfil] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    http.get("/cultura/perfil").then((r) => setPerfil(r.data)).catch(() => {});
    http.get("/cultura/grupos").then((r) => setOferta(r.data)).catch(() => setError("No fue posible cargar tus grupos."));
    http.get("/cultura/agenda").then((r) => setAgenda(r.data)).catch(() => setAgenda([]));
    http.get("/cultura/convocatorias").then((r) => setConvocatorias(r.data)).catch(() => {});
  }, []);

  const nombre = usuario?.nombre?.split(" ")[0] || "";
  const misGrupos = (oferta?.areas || []).flatMap((a) => a.grupos.filter((g) => g.inscrito).map((g) => ({ ...g, area: a.nombre })));
  const hoy = diaDeHoy();
  const conClaseHoy = misGrupos.filter((g) => (g.horario || []).some((h) => h.dia === hoy));
  const proximos = [...(agenda || [])].filter((e) => !e.terminado).sort((a, b) => (a.fecha + a.horaInicio).localeCompare(b.fecha + b.horaInicio)).slice(0, 3);
  const inscritoEventos = (agenda || []).filter((e) => e.inscrito && !e.terminado).length;
  const postulaciones = convocatorias.filter((c) => c.postulacion);
  const abiertas = convocatorias.filter((c) => !c.postulacion);

  let resumen = "Cargando tus grupos…";
  if (oferta) {
    if (!misGrupos.length) resumen = `Este periodo puedes estar en ${oferta.maxGrupos} grupos o talleres. Elige uno de música, danza, teatro o artes y empieza a participar.`;
    else if (conClaseHoy.length) resumen = `Hoy tienes ${conClaseHoy.map((g) => g.nombre).join(" y ")}. Al llegar, registra tu asistencia con el código de la sesión.`;
    else resumen = `Estás en ${misGrupos.length} ${misGrupos.length === 1 ? "grupo" : "grupos"} este periodo${inscritoEventos ? ` y en ${inscritoEventos} ${inscritoEventos === 1 ? "evento" : "eventos"} de la agenda` : ""}.`;
  }

  return (
    <>
      <BandaInicio
        fecha={`${hoyLargo()}${oferta?.periodo ? ` · Periodo ${oferta.periodo}` : ""}`}
        titulo={
          <>
            Hola, <span className="text-[#D9C8FF]">{nombre}.</span>
          </>
        }
        texto={resumen}
        acciones={
          <>
            <Link to="/mi-cultura/grupos" className={botonBandaPrincipal}>
              <Icono nombre="musica" size={18} /> {misGrupos.length ? "Ver mis grupos" : "Elegir un grupo"}
            </Link>
            <Link to="/mi-cultura/agenda" className={botonBandaSecundario}>
              <Icono nombre="calendario" size={17} /> Agenda cultural
            </Link>
          </>
        }
        lado={<RegistrarAsistencia />}
      />
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-28 flex flex-col gap-6">
        {error && <Aviso>{error}</Aviso>}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <Tarjeta
            titulo="Mis grupos"
            subtitulo={oferta && misGrupos.length ? `${oferta.inscritas} de ${oferta.maxGrupos} talleres este periodo${misGrupos.length > oferta.inscritas ? " · y grupo representativo" : ""}` : null}
            acciones={
              misGrupos.length > 0 && (
                <Link to="/mi-cultura/grupos" className={enlaceTarjeta}>
                  Ver todos →
                </Link>
              )
            }
          >
            {!oferta && !error && <Esqueleto forma="lista" cantidad={2} etiqueta="Cargando tus grupos" />}
            {oferta && misGrupos.length === 0 && (
              <EstadoVacio
                compacto
                icono="musica"
                titulo="Todavía no estás en ningún grupo"
                texto="Guitarra, piano, ritmos latinos, danzas, teatro y más. Inscríbete y tu asistencia queda registrada con tu cuenta."
                accion={
                  <Link to="/mi-cultura/grupos" className={botonPrimario}>
                    Ver grupos y talleres
                  </Link>
                }
              />
            )}
            <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
              {misGrupos.map((g) => {
                const esHoy = (g.horario || []).some((h) => h.dia === hoy);
                return (
                  <li key={g.id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${esHoy ? "border-primary/30 bg-primary-light/60" : "border-gray-200 bg-white/70"}`}>
                    {g.imagenUrl ? (
                      <img src={urlDelServidor(g.imagenUrl)} alt="" className="shrink-0 w-11 h-11 rounded-xl object-cover" />
                    ) : (
                      <span aria-hidden="true" className="shrink-0 w-11 h-11 rounded-xl bg-primary text-white grid place-items-center">
                        <Icono nombre="musica" size={20} strokeWidth={2} />
                      </span>
                    )}
                    <span className="flex-1 min-w-0 leading-tight">
                      <span className="block font-bold text-ink-900 truncate">{g.nombre}</span>
                      <span className="block text-sm text-ink-500 truncate">
                        {horarioTexto(g.horario)}
                        {g.lugar ? ` · ${g.lugar}` : ""}
                      </span>
                    </span>
                    {esHoy && <Insignia tono="dorado">Hoy</Insignia>}
                  </li>
                );
              })}
            </ul>
          </Tarjeta>

          <Tarjeta
            titulo="Próximos eventos"
            acciones={
              <Link to="/mi-cultura/agenda" className={enlaceTarjeta}>
                Ver agenda →
              </Link>
            }
          >
            {agenda === null && <Esqueleto forma="lista" cantidad={3} etiqueta="Cargando la agenda" />}
            {agenda && proximos.length === 0 && <Vacio>No hay eventos publicados por ahora. Revisa la agenda más adelante.</Vacio>}
            <ul className="list-none m-0 p-0 flex flex-col gap-1">
              {proximos.map((e) => (
                <li key={e.id}>
                  <Link to="/mi-cultura/agenda" className="group flex items-center gap-3 rounded-2xl p-2 pr-3 no-underline hover:bg-white/80 transition-colors">
                    <span className="relative shrink-0 w-[88px] h-[64px] rounded-xl overflow-hidden bg-primary-light">
                      <img
                        src={fotoEvento(e)}
                        alt=""
                        loading="lazy"
                        onError={(ev) => {
                          ev.currentTarget.src = (FOTO_TIPO[e.categoriaId] || IMAGENES.auditorio).src;
                        }}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                      />
                    </span>
                    <span className="flex-1 min-w-0 leading-tight">
                      <span className="block text-xs font-bold text-primary capitalize">
                        {fechaEvento(e.fecha)} · {e.horaInicio}
                      </span>
                      <span className="block font-bold text-ink-900 truncate">{e.nombre}</span>
                      <span className="block text-sm text-ink-500 truncate">{e.lugar || e.categoria}</span>
                    </span>
                    {e.inscrito ? <Insignia tono="verde">Inscrito</Insignia> : e.cuposDisponibles === 0 ? <Insignia tono="gris">Sin cupos</Insignia> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <Tarjeta
            titulo="Convocatorias"
            subtitulo={abiertas.length ? `${abiertas.length} ${abiertas.length === 1 ? "abierta" : "abiertas"} para postularte` : null}
            acciones={
              <Link to="/mi-cultura/convocatorias" className={enlaceTarjeta}>
                Ver →
              </Link>
            }
          >
            {postulaciones.length === 0 && abiertas.length === 0 && <Vacio>No hay convocatorias abiertas en este momento.</Vacio>}
            {postulaciones.length === 0 && abiertas.length > 0 && (
              <p className="m-0 text-ink-600">
                Audiciones y castings para los grupos representativos. La próxima cierra el <strong className="text-ink-900">{fechaLarga(abiertas[0].cierra)}</strong>.
              </p>
            )}
            <ul className="list-none m-0 p-0">
              {postulaciones.map((c) => {
                const [tono, texto] = ESTADO_POSTULACION[c.postulacion.estado] || ["gris", c.postulacion.estado];
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
                    <span className="min-w-0 font-semibold text-ink-900 truncate">{c.titulo}</span>
                    <Insignia tono={tono}>{texto}</Insignia>
                  </li>
                );
              })}
            </ul>
          </Tarjeta>
          <MisDatos perfil={perfil} alGuardar={setPerfil} />
        </div>
      </main>
    </>
  );
}

export function GruposCultura() {
  const [oferta, setOferta] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    http.get("/cultura/grupos").then((r) => setOferta(r.data)).catch(() => setError("No fue posible cargar los grupos."));
  }, []);

  async function accion(grupo, tipo) {
    setOcupado(true);
    setError("");
    setAviso("");
    try {
      const r = tipo === "inscribir" ? await http.post(`/cultura/grupos/${grupo.id}/inscripcion`) : await http.delete(`/cultura/grupos/${grupo.id}/inscripcion`);
      setOferta(r.data);
      setAviso(tipo === "inscribir" ? `Quedaste inscrito en ${grupo.nombre}.` : `Te retiraste de ${grupo.nombre}.`);
    } catch (err) {
      setError(mensajeError(err, "No fue posible completar la acción."));
    } finally {
      setOcupado(false);
    }
  }

  // Todos los grupos en dos bloques (talleres y representativos) para que las
  // tarjetas llenen el ancho, en lugar de una seccion por area con una sola tarjeta.
  const todos = (oferta?.areas || []).flatMap((a) => a.grupos.map((g) => ({ ...g, area: a.nombre, categoria: a.categoria })));
  const bloques = [
    ["Talleres de formación", "Aprende música, danza o expresión en tu tiempo libre.", todos.filter((g) => g.categoria === "Taller de formación")],
    ["Grupos representativos", "Representa a la universidad en eventos y festivales.", todos.filter((g) => g.categoria === "Grupo representativo")],
    ["Otras actividades", "", todos.filter((g) => g.categoria !== "Taller de formación" && g.categoria !== "Grupo representativo")],
  ].filter(([, , lista]) => lista.length);
  return (
    <Marco titulo="Grupos artísticos" texto={oferta ? `Periodo ${oferta.periodo}. Puedes inscribirte en ${oferta.maxGrupos} talleres (llevas ${oferta.inscritas}). A los grupos representativos se entra por audición.` : ""}>
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      {bloques.map(([titulo, ayuda, lista]) => (
        <section key={titulo} className="mb-10">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4">
            <h2 className="m-0 text-2xl font-extrabold text-primary-dark">{titulo}</h2>
            {ayuda && <p className="m-0 text-sm text-ink-500">{ayuda}</p>}
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {lista.map((grupo) => (
              <article key={grupo.id} className="vidrio-panel rounded-[22px] overflow-hidden flex flex-col">
                <div className="relative h-[140px] bg-primary-light">
                  <img
                    src={grupo.imagenUrl ? urlDelServidor(grupo.imagenUrl) : IMAGENES.auditorio.src}
                    alt={grupo.imagenUrl ? `Foto de ${grupo.nombre}` : ""}
                    loading="lazy"
                    onError={(ev) => {
                      ev.currentTarget.src = IMAGENES.auditorio.src;
                    }}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {grupo.inscrito && <span className="absolute top-3 left-3"><Insignia tono="verde">Inscrito</Insignia></span>}
                </div>
                <div className="p-4 flex flex-col gap-3 flex-1">
                <div>
                  {grupo.area && grupo.area.toLowerCase() !== grupo.nombre.toLowerCase() && <p className="m-0 mb-0.5 text-xs font-bold text-primary">{grupo.area}</p>}
                  <h3 className="m-0 font-extrabold text-primary-dark">{grupo.nombre}</h3>
                  <p className="m-0 mt-1 text-sm text-ink-500">
                    {horarioTexto(grupo.horario)}
                    {grupo.lugar ? ` · ${grupo.lugar}` : ""}
                    {grupo.director ? ` · ${grupo.director}` : ""}
                  </p>
                  {grupo.ingreso !== "audicion" && <p className="m-0 mt-1 text-sm">{grupo.cuposDisponibles} cupos libres</p>}
                </div>
                <div className="mt-auto">
                {grupo.inscrito ? (
                  <div className="flex gap-2">
                    <button type="button" disabled={ocupado} onClick={() => accion(grupo, "retirar")} className="min-h-[44px] px-4 rounded-full border border-red-300 text-red-700 bg-white/70 font-bold hover:bg-red-50">
                      Retirarme
                    </button>
                  </div>
                ) : grupo.ingreso === "audicion" ? (
                  grupo.audicion ? (
                    <Link to="/mi-cultura/convocatorias" className="boton-liquido min-h-[44px] px-4 rounded-full font-bold inline-flex items-center gap-2 no-underline">
                      <Icono nombre="estrella" size={16} strokeWidth={2.2} /> Ver audición
                      <span className="text-xs font-semibold opacity-90">· cierra {fechaEvento(grupo.audicion.cierra)}</span>
                    </Link>
                  ) : (
                    <p className="m-0 text-sm text-ink-500">Se entra por audición. Te avisaremos en Convocatorias cuando abra la próxima.</p>
                  )
                ) : grupo.cuposDisponibles < 1 ? (
                  <span className="inline-flex items-center text-sm font-bold text-ink-500 cursor-default select-none">Sin cupos</span>
                ) : (
                  <button type="button" disabled={ocupado || !grupo.inscripcionesAbiertas} onClick={() => accion(grupo, "inscribir")} className="boton-liquido min-h-[44px] px-4 rounded-full font-bold disabled:opacity-50">
                    Inscribirme
                  </button>
                )}
                </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      {oferta && todos.length === 0 && <EstadoVacio icono="musica" titulo="Todavía no hay grupos este periodo" texto="Cuando el área publique talleres y grupos representativos, aparecerán aquí para que te inscribas." />}
    </Marco>
  );
}

export { AgendaCultura } from "./AgendaCultura";

export function ConvocatoriasCultura() {
  const [lista, setLista] = useState(null);
  const [textos, setTextos] = useState({});
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    http.get("/cultura/convocatorias").then((r) => setLista(r.data)).catch(() => setError("No fue posible cargar las convocatorias."));
  }, []);
  async function enviar(id) {
    setOcupado(true);
    setError("");
    try {
      const r = await http.post(`/cultura/convocatorias/${id}/postulacion`, { motivacion: textos[id] || "" });
      setLista(r.data);
    } catch (err) {
      setError(mensajeError(err, "No fue posible enviar la postulación."));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <Marco titulo="Convocatorias" texto="Postúlate con una motivación breve. Después te citan a una audición y quien dirige el grupo decide.">
      {error && <Aviso>{error}</Aviso>}
      <div className="grid gap-5">
        {(lista || []).map((c) => (
          <article key={c.id} className="vidrio-panel rounded-[24px] overflow-hidden grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="relative h-[190px] md:h-auto md:min-h-[260px] bg-primary-light">
              <img
                src={c.imagenUrl ? urlDelServidor(c.imagenUrl) : IMAGENES.integracion.src}
                alt={c.imagenUrl ? `Foto de ${c.titulo}` : ""}
                loading="lazy"
                onError={(ev) => {
                  ev.currentTarget.src = IMAGENES.integracion.src;
                }}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(31,17,71,0)_40%,rgba(31,17,71,0.75))]" />
              <span className="absolute left-4 bottom-3 text-sm font-bold text-white">Cierra el {fechaLarga(c.cierra)}</span>
            </div>
            <div className="p-5 flex flex-col flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="m-0 text-lg font-extrabold text-primary-dark">{c.titulo}</h2>
              {c.cupo ? <Insignia tono="azul">{c.cupo} cupos</Insignia> : null}
            </div>
            {c.grupo && <p className="m-0 mt-1 text-sm font-semibold text-primary">Audición para entrar a {c.grupo}</p>}
            {c.descripcion && <p className="mt-2 mb-0 text-sm text-ink-600">{c.descripcion}</p>}
            {c.esMiembro && !c.postulacion ? (
              <p className="mt-4 mb-0 text-sm rounded-xl bg-[#ECF8F3] text-[#0B6B4F] font-semibold px-4 py-3">Ya eres parte de {c.grupo}. No necesitas postularte.</p>
            ) : c.postulacion ? (
              <>
                <p className="mt-4 mb-0 flex items-center gap-2 text-sm font-semibold text-ink-700">
                  Tu postulación: <Insignia tono={(ESTADO_POSTULACION[c.postulacion.estado] || ["gris"])[0]}>{(ESTADO_POSTULACION[c.postulacion.estado] || [, c.postulacion.estado])[1]}</Insignia>
                </p>
                <ProgresoPostulacion postulacion={c.postulacion} />
              </>
            ) : (
              <form
                className="mt-3 flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  enviar(c.id);
                }}
              >
                <label className="text-sm font-semibold" htmlFor={`mot-${c.id}`}>
                  Motivación
                </label>
                <textarea id={`mot-${c.id}`} maxLength={500} value={textos[c.id] || ""} onChange={(e) => setTextos({ ...textos, [c.id]: e.target.value })} className="border rounded-xl px-3 py-2 min-h-[90px]" />
                <button type="submit" disabled={ocupado} className="boton-liquido min-h-[44px] px-4 rounded-full font-bold w-fit disabled:opacity-50">
                  Enviar postulación
                </button>
              </form>
            )}
            </div>
          </article>
        ))}
      </div>
      {lista && lista.length === 0 && <EstadoVacio icono="estrella" titulo="No hay convocatorias abiertas" texto="Cuando haya audiciones o castings para los grupos representativos, aparecerán aquí." />}
    </Marco>
  );
}
