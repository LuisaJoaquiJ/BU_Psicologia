import { useEffect, useState } from "react";
import { http } from "../../../lib/api/http";
import { Aviso as AvisoBase, Encabezado, Insignia, claseCampo, Segmentos } from "../comunes/componentes/ui";
import { BotonFlotante, Ventana } from "../comunes/componentes/Ventana";
import { Icono } from "../comunes/componentes/Iconos";

// Encabezado y avisos de las pantallas del personal, dentro del menu lateral.
export function Marco({ titulo, texto, children }) {
  return (
    <>
      <Encabezado titulo={titulo} descripcion={texto} />
      {children}
    </>
  );
}

export function Aviso({ tono = "rojo", children }) {
  return (
    <div className="mb-4">
      <AvisoBase tono={tono}>{children}</AvisoBase>
    </div>
  );
}

// Campo sin ancho fijo: cada formulario le pone el suyo.
export const campo = claseCampo.replace("w-full ", "");

// El formulario para crear algo no ocupa la pagina: se abre desde el boton
// flotante en una ventana, como en Deporte. control = useVentana() de la pagina.
export function useVentana() {
  const [abierto, setAbierto] = useState(false);
  return { abierto, abrir: () => setAbierto(true), cerrar: () => setAbierto(false) };
}

export function Desplegable({ titulo, boton, control, error, children, visible = true }) {
  if (!visible) return null;
  return (
    <>
      <BotonFlotante onClick={control.abrir}>{boton}</BotonFlotante>
      {control.abierto && (
        <Ventana titulo={titulo} alCerrar={control.cerrar} ancho="sm:max-w-[760px]">
          {error && <Aviso>{error}</Aviso>}
          {children}
        </Ventana>
      )}
    </>
  );
}

// Opciones sin repetir para un selector de filtro, sacadas de la lista misma.
export const opcionesDe = (lista, clave) => [...new Set(lista.map((x) => (typeof clave === "function" ? clave(x) : x[clave])).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "es"));

export const coincide = (texto, ...campos) => {
  const q = String(texto || "").trim().toLowerCase();
  return !q || campos.some((c) => String(c || "").toLowerCase().includes(q));
};

// Barra de filtros de las listas: buscador en una sola linea y, al lado, un
// boton "Filtros" que despliega los selectores y las pastillas solo cuando se
// necesitan. El boton dice cuantos filtros estan activos.
//   pastillas / selectores: [{ etiqueta, valor, alCambiar, opciones: [[id, texto]] }]
export function Filtros({ buscar, alBuscar, placeholder = "Buscar", selectores = [], pastillas = [], total, visibles, alLimpiar }) {
  const [abierto, setAbierto] = useState(false);
  const opciones = [...selectores, ...pastillas];
  const activos = opciones.filter((f) => f.valor !== f.opciones[0][0]).length;
  const hayFiltro = Boolean(buscar) || activos > 0;
  return (
    <section aria-label="Filtros" className="mb-5 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex-[1_1_220px] min-w-0 max-w-[460px]">
          <span className="sr-only">{placeholder}</span>
          <span className="relative block">
            <Icono nombre="buscar" size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
            <input type="search" value={buscar} onChange={(e) => alBuscar(e.target.value)} placeholder={placeholder} className="w-full min-h-[42px] rounded-full bg-white/90 border border-white pl-10 pr-4 text-sm text-ink-900 placeholder:text-ink-400 shadow-[0_4px_14px_-8px_rgba(11,35,71,0.25)] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20" />
          </span>
        </label>
        {opciones.length > 0 && (
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className={`min-h-[42px] px-4 rounded-full text-sm font-bold inline-flex items-center gap-2 transition-colors ${abierto || activos ? "boton-liquido" : "bg-white/90 border border-white text-primary-dark hover:bg-white shadow-[0_4px_14px_-8px_rgba(11,35,71,0.25)]"}`}
          >
            <Icono nombre="lista" size={16} strokeWidth={2.2} />
            Filtros
            {activos > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-white text-primary text-xs font-extrabold grid place-items-center tabular-nums">{activos}</span>}
          </button>
        )}
        <span aria-live="polite" className="text-sm text-ink-500 tabular-nums">
          {visibles === total ? `${total} en total` : `${visibles} de ${total}`}
        </span>
        {hayFiltro && (
          <button type="button" onClick={alLimpiar} className="min-h-[36px] px-2 rounded-full text-sm font-bold text-primary hover:underline underline-offset-4">
            Quitar filtros
          </button>
        )}
      </div>
      {abierto && opciones.length > 0 && (
        <div className="vidrio-panel rounded-[18px] p-3 flex flex-col gap-2.5">
          {selectores.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {selectores.map((sel) => (
                <label key={sel.etiqueta} className="text-sm font-semibold inline-flex items-center gap-2">
                  {sel.etiqueta}
                  <select value={sel.valor} onChange={(e) => sel.alCambiar(e.target.value)} className={`${campo} min-h-[38px] py-1`}>
                    {sel.opciones.map(([id, texto]) => (
                      <option key={id} value={id}>
                        {texto}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          {pastillas.map((p) => (
            <div key={p.etiqueta} role="group" aria-label={p.etiqueta} className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold text-ink-500 w-[110px] shrink-0">{p.etiqueta}</span>
              <Segmentos opciones={p.opciones} valor={p.valor} alCambiar={p.alCambiar} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Lista vacia por los filtros: dice por que y como volver a verla toda.
export function SinResultados({ hayDatos, vacio, alLimpiar }) {
  return (
    <div className="vidrio-panel rounded-[22px] p-8 text-center flex flex-col items-center gap-3">
      <p className="m-0 font-extrabold text-primary-dark">{hayDatos ? "Nada coincide con estos filtros" : vacio}</p>
      {hayDatos && (
        <button type="button" onClick={alLimpiar} className="min-h-[40px] px-4 rounded-full burbuja text-primary-dark font-bold">
          Quitar filtros
        </button>
      )}
    </div>
  );
}

// "3 estudiantes · 2 egresados": lo que el area quiere ver de una vez.
const PLURAL = { Estudiante: "estudiantes", Docente: "docentes", Administrativo: "administrativos", Egresado: "egresados" };
export function ResumenTipos({ porTipo = {} }) {
  const filas = Object.entries(porTipo).filter(([, n]) => n);
  if (!filas.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {filas.map(([tipo, n]) => (
        <Insignia key={tipo} tono="azul">
          {n} {n === 1 ? tipo.toLowerCase() : PLURAL[tipo] || tipo}
        </Insignia>
      ))}
    </div>
  );
}

// Busca por nombre, correo o cedula a quien ya entro a Cultura y lo agrega.
export function BuscarPersona({ alElegir, etiqueta = "Buscar por nombre, correo o cédula" }) {
  const [q, setQ] = useState("");
  const [hallados, setHallados] = useState([]);
  useEffect(() => {
    if (q.trim().length < 3) {
      setHallados([]);
      return undefined;
    }
    const espera = setTimeout(() => {
      http.get("/cultura/admin/inscritos", { params: { q } }).then((r) => setHallados(r.data)).catch(() => setHallados([]));
    }, 250);
    return () => clearTimeout(espera);
  }, [q]);
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold">
        {etiqueta}
        <input className={`${campo} w-full mt-1`} value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {hallados.length > 0 && (
        <ul className="list-none m-0 p-0 flex flex-col gap-1">
          {hallados.map((p) => (
            <li key={p.usuarioId}>
              <button
                type="button"
                onClick={() => {
                  alElegir(p);
                  setQ("");
                }}
                className="w-full text-left burbuja rounded-xl px-3 py-2 text-sm hover:bg-white"
              >
                <strong>{p.nombre}</strong> · {p.email}
                {p.programa ? ` · ${p.programa}` : ""}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
