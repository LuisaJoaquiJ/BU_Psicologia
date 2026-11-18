import { useMemo, useState } from "react";
import { http } from "../../../lib/api/http";
import { Aviso, botonPrimario } from "../comunes/componentes/ui";
import { Icono } from "../comunes/componentes/Iconos";

// Publicar horarios "pintando" la semana: se tocan las horas en que se
// atiende, se elige la duración de cada cita y cuántas semanas se repite, y
// se publican todas de una vez. Usa el mismo endpoint de crear horario
// (POST {api}/horarios), una vez por cita.

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const HORAS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const REPETIR = [
  { semanas: 1, texto: "Esta semana" },
  { semanas: 4, texto: "4 semanas" },
  { semanas: 8, texto: "8 semanas" },
  { semanas: 16, texto: "16 semanas" },
];
const MESES_CORTOS = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sept.", "oct.", "nov.", "dic."];

const dosDigitos = (n) => String(n).padStart(2, "0");
const isoDe = (d) => d.toISOString().slice(0, 10);

function lunesDe(fecha) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return isoDe(d);
}
function sumarDias(fecha, n) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDe(d);
}
function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
}
function etiquetaHora(h, m = 0) {
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${dosDigitos(m)} ${h < 12 ? "a. m." : "p. m."}`;
}
function diaCorto(fecha) {
  return `${Number(fecha.slice(8))} ${MESES_CORTOS[Number(fecha.slice(5, 7)) - 1]}`;
}

// Citas que salen de un bloque de una hora según la duración elegida.
function citasDelBloque(hora, duracion) {
  if (duracion === 30) return [[hora, 0, hora, 30], [hora, 30, hora + 1, 0]];
  if (duracion === 45) return [[hora, 0, hora, 45]];
  return [[hora, 0, hora + 1, 0]];
}

// Chips ligeros: tinte suave institucional cuando están activos y gris neutro en reposo.
const chip = (activo) =>
  `w-full min-h-[40px] px-2.5 rounded-xl border-[1.5px] text-xs sm:text-sm font-bold flex items-center justify-center text-center whitespace-nowrap cursor-pointer transition-all duration-150 ${
    activo
      ? "border-[#19407B] bg-[#EBF2FA] text-[#19407B]"
      : "border-transparent bg-[#F4F6F9] text-ink-600 hover:bg-[#EAEFF5] hover:text-ink-900"
  }`;

export function PublicarSemana({ api, servicios, horarios, alPublicar }) {
  const [servicioId, setServicioId] = useState("");
  const [duracion, setDuracion] = useState(45);
  const [semanas, setSemanas] = useState(4);
  const [lunes, setLunes] = useState(() => lunesDe(hoyLocal()));
  const [nuevos, setNuevos] = useState({}); // "d-h" -> true
  const [publicando, setPublicando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");

  const servicioActual = servicioId || servicios[0]?.id || "";
  const hoy = hoyLocal();
  const fechas = DIAS.map((_, i) => sumarDias(lunes, i));

  // Horarios ya publicados de este servicio en la semana visible, por casilla.
  const existentes = useMemo(() => {
    const mapa = {};
    for (const h of horarios || []) {
      if (h.servicioId !== servicioActual && h.servicio?.id !== servicioActual) continue;
      const d = fechas.indexOf(h.fecha.slice(0, 10));
      if (d < 0) continue;
      const hora = new Date(h.horaInicio).getUTCHours();
      const clave = `${d}-${hora}`;
      mapa[clave] = mapa[clave] === "ocupado" || h.ocupado ? "ocupado" : "publicado";
    }
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horarios, servicioActual, lunes]);

  const bloques = Object.keys(nuevos).length;
  const total = bloques * (duracion === 30 ? 2 : 1) * semanas;

  function alternar(clave) {
    setResultado(null);
    setNuevos((n) => {
      const copia = { ...n };
      if (copia[clave]) delete copia[clave];
      else copia[clave] = true;
      return copia;
    });
  }

  function cambiarSemana(delta) {
    setNuevos({});
    setResultado(null);
    setLunes((l) => sumarDias(l, 7 * delta));
  }

  // Marca las mismas horas que se publicaron la semana anterior.
  function copiarSemanaAnterior() {
    const anteriores = DIAS.map((_, i) => sumarDias(lunes, i - 7));
    const marcas = {};
    for (const h of horarios || []) {
      if (h.servicioId !== servicioActual && h.servicio?.id !== servicioActual) continue;
      const d = anteriores.indexOf(h.fecha.slice(0, 10));
      if (d < 0) continue;
      const clave = `${d}-${new Date(h.horaInicio).getUTCHours()}`;
      if (!existentes[clave] && fechas[d] >= hoy) marcas[clave] = true;
    }
    setResultado(
      Object.keys(marcas).length ? null : { tono: "azul", texto: "La semana anterior no tiene horarios de este servicio para copiar." }
    );
    setNuevos(marcas);
  }

  async function publicar() {
    setError("");
    setResultado(null);
    setPublicando(true);
    const peticiones = [];
    for (let s = 0; s < semanas; s++) {
      for (const clave of Object.keys(nuevos)) {
        const [d, hora] = clave.split("-").map(Number);
        const fecha = sumarDias(fechas[d], 7 * s);
        for (const [h1, m1, h2, m2] of citasDelBloque(hora, duracion)) {
          peticiones.push({
            servicioId: servicioActual,
            fecha,
            horaInicio: `${dosDigitos(h1)}:${dosDigitos(m1)}`,
            horaFin: `${dosDigitos(h2)}:${dosDigitos(m2)}`,
            cupo: 1,
          });
        }
      }
    }
    let creadas = 0;
    let repetidas = 0;
    let fallidas = 0;
    // De a cinco a la vez para no saturar el servidor.
    for (let i = 0; i < peticiones.length; i += 5) {
      const lote = await Promise.allSettled(peticiones.slice(i, i + 5).map((datos) => http.post(`${api}/horarios`, datos)));
      for (const r of lote) {
        if (r.status === "fulfilled") creadas++;
        else if (r.reason?.response?.status === 409) repetidas++;
        else fallidas++;
      }
    }
    setPublicando(false);
    setNuevos({});
    if (!creadas && fallidas) {
      setError("No pudimos publicar los horarios. Revisa tu conexión e intenta de nuevo.");
    } else {
      const partes = [`Publicaste ${creadas} ${creadas === 1 ? "cita" : "citas"}. Los estudiantes ya las pueden pedir.`];
      if (repetidas) partes.push(`${repetidas} ya existían o se cruzaban con otro horario y no se repitieron.`);
      if (fallidas) partes.push(`${fallidas} no se pudieron crear; inténtalo de nuevo más tarde.`);
      setResultado({ tono: fallidas ? "dorado" : "verde", texto: partes.join(" ") });
    }
    await alPublicar?.();
  }

  const finRepeticion = sumarDias(fechas[4], 7 * (semanas - 1));

  return (
    <section aria-labelledby="pintar-semana" className="grid gap-5 lg:grid-cols-[310px_minmax(0,1fr)] items-start">
      {/* Columna izquierda: Configuración */}
      <div className="min-w-0 bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5 flex flex-col gap-4">
        <h2 id="pintar-semana" className="m-0 text-lg font-extrabold text-ink-900">
          Publicar horarios
        </h2>

        <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-600">
          Servicio
          <select
            value={servicioActual}
            onChange={(e) => {
              setServicioId(e.target.value);
              setNuevos({});
            }}
            className="min-h-[42px] px-3 border border-gray-200 rounded-xl text-sm font-semibold text-ink-900 bg-white focus:border-[#19407B] focus:outline-none"
          >
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="m-0 mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-600">Duración de cada cita</p>
          <div role="group" aria-label="Duración" className="grid grid-cols-3 gap-2">
            {[30, 45, 60].map((m) => (
              <button key={m} type="button" aria-pressed={duracion === m} onClick={() => setDuracion(m)} className={chip(duracion === m)}>
                {m} min
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="m-0 mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-600">¿Se repite?</p>
          <div role="group" aria-label="Repetición" className="grid grid-cols-2 gap-2">
            {REPETIR.map((r) => (
              <button key={r.semanas} type="button" aria-pressed={semanas === r.semanas} onClick={() => setSemanas(r.semanas)} className={chip(semanas === r.semanas)}>
                {r.texto}
              </button>
            ))}
          </div>
          <p className="mt-1.5 mb-0 text-xs text-ink-500">
            {semanas === 1 ? "Solo para la semana que ves." : `Cada semana, hasta el viernes ${diaCorto(finRepeticion)}.`}
          </p>
        </div>

        <div className="flex flex-col gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={copiarSemanaAnterior}
            className="w-full min-h-[40px] px-3 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-bold text-[#19407B] hover:bg-[#F4F6F9] hover:border-gray-300 transition-colors cursor-pointer"
          >
            Copiar semana anterior
          </button>
          {bloques > 0 && (
            <button
              type="button"
              onClick={() => setNuevos({})}
              className="w-full min-h-[34px] rounded-xl text-xs font-bold text-ink-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
            >
              Quitar selección ({bloques})
            </button>
          )}
        </div>

        <div className="p-4 rounded-xl bg-[#F8FAFC] border border-gray-200/80">
          <p className="m-0 mb-3 tabular-nums leading-snug" aria-live="polite">
            <strong className="text-sm text-ink-900">
              {bloques ? `${bloques} ${bloques === 1 ? "hora marcada" : "horas marcadas"}` : "Aún no marcas horas"}
            </strong>
            <br />
            <span className="text-xs text-ink-500">
              {bloques
                ? `Se crearán ${total} citas de ${duracion} min${semanas > 1 ? ` en ${semanas} semanas` : ""}.`
                : "Toca las casillas vacías de la semana."}
            </span>
          </p>
          <button
            type="button"
            onClick={publicar}
            disabled={!bloques || publicando}
            className={`${botonPrimario} w-full disabled:cursor-not-allowed`}
          >
            {publicando ? "Publicando…" : bloques ? `Publicar ${total} citas` : "Publicar horarios"}
          </button>
        </div>
      </div>

      {/* Columna derecha: Parrilla semanal */}
      <div className="min-w-0 bg-white rounded-2xl border border-gray-200/80 shadow-sm p-4 sm:p-5">
        {resultado && (
          <div className="mb-4" role="status">
            <Aviso tono={resultado.tono}>{resultado.texto}</Aviso>
          </div>
        )}
        {error && (
          <div className="mb-4">
            <Aviso>{error}</Aviso>
          </div>
        )}

        <div className="flex justify-between items-center gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Semana anterior"
              onClick={() => cambiarSemana(-1)}
              className="w-9 h-9 rounded-xl border border-gray-200 bg-[#F4F6F9] text-[#19407B] flex items-center justify-center hover:bg-[#EBF2FA] transition-colors cursor-pointer shrink-0"
            >
              <Icono nombre="izquierda" size={16} strokeWidth={2.4} />
            </button>
            <h3 className="m-0 text-base sm:text-lg font-extrabold text-ink-900 tabular-nums whitespace-nowrap" aria-live="polite">
              Semana del {diaCorto(fechas[0])} al {diaCorto(fechas[4])}
            </h3>
            <button
              type="button"
              aria-label="Semana siguiente"
              onClick={() => cambiarSemana(1)}
              className="w-9 h-9 rounded-xl border border-gray-200 bg-[#F4F6F9] text-[#19407B] flex items-center justify-center hover:bg-[#EBF2FA] transition-colors cursor-pointer shrink-0"
            >
              <Icono nombre="derecha" size={16} strokeWidth={2.4} />
            </button>
          </div>

          <ul aria-label="Convenciones" className="list-none m-0 p-0 flex gap-3.5 flex-wrap text-xs sm:text-sm font-semibold text-ink-600">
            <li className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-[4px] border-2 border-dashed border-[#0891B2] bg-cyan-light shrink-0" />
              Nuevo
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-[4px] bg-primary-light shrink-0" />
              Publicado
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-[4px] bg-primary-dark shrink-0" />
              Ocupado
            </li>
          </ul>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="min-w-[500px] grid grid-cols-[76px_repeat(5,minmax(0,1fr))] gap-1.5 tabular-nums">
            <span />
            {fechas.map((f, i) => (
              <span key={f} className={`text-center pb-1.5 ${f < hoy ? "text-ink-500" : ""}`}>
                <strong className="block text-sm text-ink-900">{DIAS[i]}</strong>
                <span className="text-xs text-ink-500">{diaCorto(f)}</span>
              </span>
            ))}
            {HORAS.map((hora) => [
              <span key={`h${hora}`} className="flex items-center text-xs font-bold text-ink-500 whitespace-nowrap">
                {etiquetaHora(hora)}
              </span>,
              ...fechas.map((f, d) => {
                const clave = `${d}-${hora}`;
                const estado = existentes[clave];
                const etiqueta = `${DIAS[d]} ${diaCorto(f)}, ${etiquetaHora(hora)}`;
                const base = "min-h-[40px] w-full rounded-xl text-xs font-extrabold flex items-center justify-center text-center px-1";
                if (estado === "ocupado")
                  return (
                    <span key={clave} aria-label={`${etiqueta}: ocupado`} className={`${base} bg-primary-dark text-white`}>
                      Ocupado
                    </span>
                  );
                if (estado === "publicado")
                  return (
                    <span key={clave} aria-label={`${etiqueta}: publicado`} className={`${base} bg-primary-light text-primary`}>
                      Publicado
                    </span>
                  );
                if (f < hoy) return <span key={clave} aria-hidden="true" className={`${base} bg-cream/70`} />;
                const marcado = !!nuevos[clave];
                return (
                  <button
                    key={clave}
                    type="button"
                    aria-pressed={marcado}
                    aria-label={`${etiqueta}: ${marcado ? "nuevo, toca para quitar" : "libre, toca para agregar"}`}
                    onClick={() => alternar(clave)}
                    className={`${base} cursor-pointer transition-colors ${
                      marcado
                        ? "border-2 border-dashed border-[#0891B2] bg-cyan-light text-cyan-dark"
                        : "border border-gray-200 bg-white text-ink-500 hover:border-[#19407B]/50 hover:bg-[#F8FAFC]"
                    }`}
                  >
                    {marcado ? "Nuevo" : ""}
                  </button>
                );
              }),
            ])}
          </div>
        </div>

        <p className="mt-3 mb-0 text-xs sm:text-sm text-ink-500">
          Cada casilla es la hora en que empiezan las citas. Para cerrar un horario ya publicado, hazlo desde la lista de «Mis horarios de atención».
        </p>
      </div>
    </section>
  );
}