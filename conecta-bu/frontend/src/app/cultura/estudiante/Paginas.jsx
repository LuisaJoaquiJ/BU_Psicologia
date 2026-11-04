import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { horarioTexto, mensajeError } from "../comun/formato";

function Aviso({ tono = "rojo", children }) {
  const clase = tono === "verde" ? "bg-emerald-50 text-emerald-800 border-emerald-100" : "bg-red-50 text-red-700 border-red-100";
  return <p className={`m-0 mb-4 text-sm border rounded-xl px-4 py-3 ${clase}`}>{children}</p>;
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

// Reemplaza la firma en el listado: quien esta en la sesion escribe el codigo que muestran ahi.
function RegistrarAsistencia() {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState("");
  async function enviar(e) {
    e.preventDefault();
    setError("");
    setHecho("");
    try {
      const { data } = await http.post("/cultura/asistencia", { codigo });
      setHecho(`Asistencia registrada: ${data.actividad}.`);
      setCodigo("");
    } catch (err) {
      setError(mensajeError(err, "No fue posible registrar tu asistencia."));
    }
  }
  return (
    <section className="bg-white border rounded-2xl p-4 mb-6 max-w-md">
      <h2 className="m-0 text-lg font-extrabold">Registra tu asistencia</h2>
      <p className="m-0 mt-1 mb-3 text-sm text-ink-500">Escribe el código que muestran en la sesión o el evento.</p>
      {error && <Aviso>{error}</Aviso>}
      {hecho && <Aviso tono="verde">{hecho}</Aviso>}
      <form onSubmit={enviar} className="flex gap-2">
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          required
          maxLength={8}
          autoComplete="off"
          aria-label="Código de la sesión"
          className="border rounded-xl px-3 min-h-[44px] min-w-0 flex-1 font-mono tracking-[0.15em] uppercase"
        />
        <button type="submit" className="boton-liquido min-h-[44px] px-5 rounded-full font-bold shrink-0">
          Registrar
        </button>
      </form>
    </section>
  );
}

export function InicioCultura() {
  const [grupos, setGrupos] = useState(null);
  const [agenda, setAgenda] = useState([]);
  const [convocatorias, setConvocatorias] = useState([]);
  const [perfil, setPerfil] = useState(null);
  const [aviso, setAviso] = useState("");
  useEffect(() => {
    http.get("/cultura/perfil").then((r) => setPerfil(r.data)).catch(() => {});
    http.get("/cultura/grupos").then((r) => setGrupos(r.data)).catch(() => setGrupos({ inscritas: 0, maxGrupos: 2 }));
    http.get("/cultura/agenda").then((r) => setAgenda(r.data.filter((e) => e.inscrito))).catch(() => {});
    http.get("/cultura/convocatorias").then((r) => setConvocatorias(r.data.filter((c) => c.postulacion))).catch(() => {});
  }, []);
  async function guardarTipo(tipoSnies) {
    const r = await http.put("/cultura/perfil", { tipoSnies: Number(tipoSnies) });
    setPerfil(r.data);
    setAviso("Quedó guardado tu tipo de usuario para el informe SNIES.");
  }
  return (
    <Marco titulo="Arte y Cultura" texto="Grupos artísticos del periodo, presentaciones y convocatorias de Bienestar. La asistencia queda con tu usuario, la hora y la dirección IP.">
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      <RegistrarAsistencia />
      <label className="text-sm font-semibold flex flex-col gap-1 max-w-sm mb-6">
        Tipo de usuario (código SNIES de esta ficha)
        <select className="border rounded-xl px-3 min-h-[44px]" value={perfil?.tipoSnies || 1} onChange={(e) => guardarTipo(e.target.value)}>
          {(perfil?.tipos || [
            { codigo: 1, nombre: "Estudiante" },
            { codigo: 2, nombre: "Docente" },
            { codigo: 3, nombre: "Administrativo" },
            { codigo: 4, nombre: "Egresado" },
          ]).map((t) => (
            <option key={t.codigo} value={t.codigo}>{t.codigo} · {t.nombre}</option>
          ))}
        </select>
      </label>
      <form
        key={`${perfil?.documento || ""}-${perfil?.programa || ""}-${perfil?.caracterizacion || ""}`}
        className="grid gap-3 sm:grid-cols-3 mb-6"
        onSubmit={async (e) => {
          e.preventDefault();
          const datos = new FormData(e.currentTarget);
          const r = await http.put("/cultura/perfil", {
            tipoSnies: perfil?.tipoSnies || 1,
            documento: datos.get("documento"),
            programa: datos.get("programa"),
            caracterizacion: datos.get("caracterizacion"),
          });
          setPerfil(r.data);
          setAviso("Quedaron guardados tu programa, tu cédula y tu caracterización.");
        }}
      >
        <label className="text-sm font-semibold">Cédula<input name="documento" defaultValue={perfil?.documento || ""} className="border rounded-xl px-3 min-h-[44px] w-full mt-1" /></label>
        <label className="text-sm font-semibold">Programa académico<input name="programa" defaultValue={perfil?.programa || ""} className="border rounded-xl px-3 min-h-[44px] w-full mt-1" /></label>
        <label className="text-sm font-semibold">Caracterización
          <select name="caracterizacion" defaultValue={perfil?.caracterizacion || "No registra"} className="border rounded-xl px-3 min-h-[44px] w-full mt-1">
            {(perfil?.caracterizaciones || ["No registra"]).map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <button className="boton-liquido min-h-[44px] px-4 rounded-full font-bold w-fit">Guardar perfil</button>
      </form>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/mi-cultura/grupos" className="bg-white border rounded-2xl p-5 no-underline text-ink-900">
          <p className="m-0 text-sm text-ink-500">Grupos</p>
          <p className="m-0 mt-1 text-2xl font-extrabold">{grupos ? `${grupos.inscritas} de ${grupos.maxGrupos}` : "…"}</p>
        </Link>
        <Link to="/mi-cultura/agenda" className="bg-white border rounded-2xl p-5 no-underline text-ink-900">
          <p className="m-0 text-sm text-ink-500">Eventos en los que estás</p>
          <p className="m-0 mt-1 text-2xl font-extrabold">{agenda.length}</p>
        </Link>
        <Link to="/mi-cultura/convocatorias" className="bg-white border rounded-2xl p-5 no-underline text-ink-900">
          <p className="m-0 text-sm text-ink-500">Postulaciones</p>
          <p className="m-0 mt-1 text-2xl font-extrabold">{convocatorias.length}</p>
        </Link>
      </div>
    </Marco>
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

  return (
    <Marco titulo="Grupos artísticos" texto={oferta ? `Periodo ${oferta.periodo}. Puedes estar en ${oferta.maxGrupos} grupos (llevas ${oferta.inscritas}).` : ""}>
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      {(oferta?.areas || []).map((area) => (
        <section key={area.id} className="mb-8">
                  <h2 className="m-0 mb-3 text-xl font-extrabold">{area.nombre}</h2>
                  <p className="m-0 -mt-2 mb-3 text-sm text-ink-500">{area.categoria}</p>
          <div className="grid gap-3">
            {area.grupos.map((grupo) => (
              <article key={grupo.id} className="bg-white border rounded-2xl p-4 flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <h3 className="m-0 font-extrabold">{grupo.nombre}</h3>
                  <p className="m-0 mt-1 text-sm text-ink-500">
                    {horarioTexto(grupo.horario)}
                    {grupo.lugar ? ` · ${grupo.lugar}` : ""}
                    {grupo.director ? ` · ${grupo.director}` : ""}
                  </p>
                  <p className="m-0 mt-1 text-sm">{grupo.cuposDisponibles} cupos libres</p>
                </div>
                {grupo.inscrito ? (
                  <div className="flex gap-2">
                    <button type="button" disabled={ocupado} onClick={() => accion(grupo, "retirar")} className="min-h-[44px] px-4 rounded-full border font-bold">
                      Retirarme
                    </button>
                  </div>
                ) : grupo.cuposDisponibles < 1 ? (
                  <button type="button" disabled className="min-h-[44px] px-4 rounded-full border font-bold opacity-60">
                    Sin cupos
                  </button>
                ) : (
                  <button type="button" disabled={ocupado || !grupo.inscripcionesAbiertas} onClick={() => accion(grupo, "inscribir")} className="boton-liquido min-h-[44px] px-4 rounded-full font-bold disabled:opacity-50">
                    Inscribirme
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
      {oferta && oferta.areas.length === 0 && <p className="text-ink-500">Todavía no hay grupos publicados en este periodo.</p>}
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
    <Marco titulo="Convocatorias" texto="Postúlate con una motivación breve. El área revisa y acepta o rechaza.">
      {error && <Aviso>{error}</Aviso>}
      <div className="grid gap-4">
        {(lista || []).map((c) => (
          <article key={c.id} className="bg-white border rounded-2xl p-4">
            <h2 className="m-0 font-extrabold">{c.titulo}</h2>
            <p className="m-0 mt-1 text-sm text-ink-500">Cierra el {c.cierra}</p>
            {c.descripcion && <p className="mt-2 mb-0 text-sm">{c.descripcion}</p>}
            {c.postulacion ? (
              <p className="mt-3 mb-0 font-bold">Tu postulación está {c.postulacion.estado.toLowerCase()}.</p>
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
          </article>
        ))}
      </div>
      {lista && lista.length === 0 && <p className="text-ink-500">No hay convocatorias abiertas.</p>}
    </Marco>
  );
}
