import { useEffect, useState } from "react";
import { http } from "../../../lib/api/http";
import { Aviso as AvisoBase, Encabezado, Insignia, claseCampo } from "../comunes/componentes/ui";
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

export function Desplegable({ titulo, boton, control, error, children }) {
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

// Barra de filtros de las listas: busqueda, selectores, pastillas y cuantos se ven.
//   pastillas / selectores: [{ etiqueta, valor, alCambiar, opciones: [[id, texto]] }]
export function Filtros({ buscar, alBuscar, placeholder = "Buscar", selectores = [], pastillas = [], total, visibles, alLimpiar }) {
  const hayFiltro = Boolean(buscar) || [...selectores, ...pastillas].some((f) => f.valor !== f.opciones[0][0]);
  return (
    <section aria-label="Filtros" className="vidrio-panel rounded-[22px] p-4 mb-5 flex flex-col gap-3">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="flex-[1_1_260px] min-w-0 text-sm font-semibold">
          <span className="sr-only">{placeholder}</span>
          <span className="relative block">
            <Icono nombre="buscar" size={18} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
            <input type="search" value={buscar} onChange={(e) => alBuscar(e.target.value)} placeholder={placeholder} className={`${campo} w-full pl-10`} />
          </span>
        </label>
        {selectores.map((s) => (
          <label key={s.etiqueta} className="text-sm font-semibold flex flex-col gap-1">
            {s.etiqueta}
            <select value={s.valor} onChange={(e) => s.alCambiar(e.target.value)} className={campo}>
              {s.opciones.map(([id, texto]) => (
                <option key={id} value={id}>
                  {texto}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {pastillas.map((p) => (
        <div key={p.etiqueta} role="group" aria-label={p.etiqueta} className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink-500 mr-1">{p.etiqueta}</span>
          {p.opciones.map(([id, texto]) => (
            <button
              key={id}
              type="button"
              aria-pressed={p.valor === id}
              onClick={() => p.alCambiar(id)}
              className={`min-h-[38px] px-4 rounded-full text-sm font-bold ${p.valor === id ? "boton-liquido" : "burbuja text-ink-600 hover:bg-white"}`}
            >
              {texto}
            </button>
          ))}
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-500">
        <span aria-live="polite">
          Mostrando <strong className="text-ink-900 tabular-nums">{visibles}</strong> de <span className="tabular-nums">{total}</span>
        </span>
        {hayFiltro && (
          <button type="button" onClick={alLimpiar} className="min-h-[36px] px-3 rounded-full font-bold text-primary hover:bg-white">
            Quitar filtros
          </button>
        )}
      </div>
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
