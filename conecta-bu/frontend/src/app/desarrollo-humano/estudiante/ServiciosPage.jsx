import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { Aviso, EstadoVacio, botonSecundario } from "../comunes/componentes/ui";
import { Icono } from "../comunes/componentes/Iconos";

// Devuelve configuración visual (ícono, etiqueta y acento) según el nombre del servicio.
function obtenerEstiloServicio(nombre = "") {
  const n = nombre.toLowerCase();
  if (n.includes("psico")) {
    return {
      icono: "corazon",
      etiqueta: "Salud emocional",
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200/70",
      iconClass: "bg-rose-50 text-rose-600 ring-rose-100",
    };
  }
  if (n.includes("nutri")) {
    return {
      icono: "ola",
      etiqueta: "Alimentación",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
      iconClass: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    };
  }
  if (n.includes("deporte") || n.includes("fisio")) {
    return {
      icono: "balon",
      etiqueta: "Actividad física",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200/70",
      iconClass: "bg-amber-50 text-amber-600 ring-amber-100",
    };
  }
  if (n.includes("salud") || n.includes("médic") || n.includes("medic")) {
    return {
      icono: "estetoscopio",
      etiqueta: "Atención médica",
      badgeClass: "bg-sky-50 text-sky-700 border-sky-200/70",
      iconClass: "bg-sky-50 text-sky-600 ring-sky-100",
    };
  }
  return {
    icono: "usuarios",
    etiqueta: "Orientación",
    badgeClass: "bg-primary-light/70 text-primary border-primary/20",
    iconClass: "bg-primary-light text-primary ring-primary/15",
  };
}

function TarjetaEsqueleto() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 p-6 flex flex-col justify-between gap-6 animate-pulse">
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gray-100" />
          <div className="h-6 w-24 rounded-full bg-gray-100" />
        </div>
        <div className="h-5 w-2/3 rounded-lg bg-gray-200/80 mb-3" />
        <div className="space-y-2">
          <div className="h-3.5 w-full rounded bg-gray-100" />
          <div className="h-3.5 w-5/6 rounded bg-gray-100" />
        </div>
      </div>
      <div className="pt-4 border-t border-gray-100 flex justify-end">
        <div className="h-10 w-36 rounded-full bg-gray-100" />
      </div>
    </div>
  );
}

// RF-003 / HU-06: consulta de servicios de Desarrollo Humano / Orientación.
export function ServiciosPage() {
  const [servicios, setServicios] = useState(null);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    http
      .get("/servicios")
      .then((res) => setServicios(res.data.servicios))
      .catch(() =>
        setError("No fue posible cargar los servicios. Intenta de nuevo más tarde.")
      );
  }, []);

  const serviciosFiltrados = useMemo(() => {
    if (!servicios) return [];
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return servicios;
    return servicios.filter(
      (s) =>
        s.nombre?.toLowerCase().includes(termino) ||
        s.descripcion?.toLowerCase().includes(termino)
    );
  }, [servicios, busqueda]);

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 sm:pt-10 pb-20">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">
        {/* Encabezado enriquecido */}
        <header className="relative overflow-hidden rounded-3xl bg-white border border-gray-200/90 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-light/80 text-primary text-[11px] font-bold uppercase tracking-[0.12em] mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Orientación · Bienestar Institucional
              </div>
              <h1 className="font-sans text-[28px] sm:text-[36px] leading-[1.15] tracking-[-0.025em] font-extrabold text-ink-900">
                Servicios de Desarrollo Humano
              </h1>
              <p className="mt-2.5 text-sm sm:text-[15px] leading-relaxed text-ink-600">
                Explora la oferta de acompañamiento integral disponible para ti y agenda tu cita en los horarios habilitados.
              </p>
            </div>

            {/* Buscador rápido cuando hay varios servicios */}
            {servicios?.length > 3 && (
              <div className="w-full lg:w-72 shrink-0">
                <label htmlFor="buscar-servicio" className="sr-only">
                  Buscar servicio
                </label>
                <div className="relative">
                  <input
                    id="buscar-servicio"
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Filtrar por área o servicio..."
                    className="w-full h-11 pl-4 pr-9 rounded-xl bg-gray-50/80 border border-gray-200 text-sm text-ink-900 placeholder:text-ink-400 focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
                  />
                  {busqueda && (
                    <button
                      type="button"
                      onClick={() => setBusqueda("")}
                      aria-label="Limpiar búsqueda"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-400 hover:text-ink-700 px-1.5 py-0.5 rounded"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Barra de conteo y acceso rápido al asistente */}
          {servicios?.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-500">
              <span>
                Mostrando{" "}
                <strong className="font-bold text-ink-900">
                  {serviciosFiltrados.length}
                </strong>{" "}
                {serviciosFiltrados.length === 1 ? "servicio disponible" : "servicios disponibles"}
              </span>
              <Link
                to="/estudiante/asistente"
                className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
              >
                ¿No sabes cuál elegir? Consulta al asistente →
              </Link>
            </div>
          )}
        </header>

        {error && <Aviso>{error}</Aviso>}

        {/* Estado de carga */}
        {!servicios && !error && (
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5"
            aria-label="Cargando servicios"
          >
            <TarjetaEsqueleto />
            <TarjetaEsqueleto />
            <TarjetaEsqueleto />
            <TarjetaEsqueleto />
          </div>
        )}

        {/* Estado vacío inicial */}
        {servicios && servicios.length === 0 && (
          <EstadoVacio
            icono="cuadricula"
            titulo="Aún no hay servicios publicados"
            texto="Bienestar publicará pronto sus servicios de orientación. Si tienes una duda, el asistente te puede ayudar."
            accion={
              <Link to="/estudiante/asistente" className={botonSecundario}>
                Hablar con el asistente
              </Link>
            }
          />
        )}

        {/* Sin resultados de búsqueda */}
        {servicios?.length > 0 && serviciosFiltrados.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-base font-bold text-ink-900">
              No encontramos servicios para "{busqueda}"
            </p>
            <p className="mt-1 text-sm text-ink-500">
              Intenta con otro término o revisa toda la oferta disponible.
            </p>
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className={`${botonSecundario} mt-4`}
            >
              Ver todos los servicios
            </button>
          </div>
        )}

        {/* Cuadrícula de servicios */}
        {serviciosFiltrados.length > 0 && (
          <ul
            aria-live="polite"
            className="list-none grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5"
          >
            {serviciosFiltrados.map((servicio) => {
              const estilo = obtenerEstiloServicio(servicio.nombre);

              return (
                <li
                  key={servicio.id}
                  className="group bg-white rounded-2xl border border-gray-200/90 shadow-sm hover:shadow-lg hover:shadow-gray-200/50 hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between p-6"
                >
                  <div>
                    {/* Cabecera de tarjeta: Ícono + Etiqueta de área */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <span
                        className={`w-12 h-12 shrink-0 rounded-2xl ring-1 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${estilo.iconClass}`}
                      >
                        <Icono
                          nombre={estilo.icono}
                          size={22}
                          strokeWidth={2}
                        />
                      </span>

                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${estilo.badgeClass}`}
                      >
                        {estilo.etiqueta}
                      </span>
                    </div>

                    {/* Título y descripción */}
                    <h2 className="font-sans text-lg sm:text-[19px] leading-snug font-extrabold text-ink-900 group-hover:text-primary transition-colors">
                      {servicio.nombre}
                    </h2>

                    {servicio.descripcion ? (
                      <p className="mt-2 text-sm leading-relaxed text-ink-600 line-clamp-3">
                        {servicio.descripcion}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm italic text-ink-400">
                        Consulta disponibilidad y horarios de atención para este servicio.
                      </p>
                    )}
                  </div>

                  {/* Pie de tarjeta con CTA */}
                  <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-ink-400">
                      {servicio.duracion
                        ? `Sesión · ${servicio.duracion}`
                        : "Agendamiento en línea"}
                    </span>

                    <Link
                      to={`/estudiante/agendar?servicio=${servicio.id}`}
                      className="inline-flex items-center gap-2 min-h-[40px] px-5 rounded-full boton-liquido font-extrabold text-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      Ver horarios
                      <span className="transition-transform duration-200 group-hover:translate-x-0.5 inline-flex">
                        <Icono nombre="flecha" size={16} strokeWidth={2.2} />
                      </span>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}