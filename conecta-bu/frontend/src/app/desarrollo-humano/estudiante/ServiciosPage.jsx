import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { Aviso, EstadoVacio, botonSecundario, Esqueleto } from "../comunes/componentes/ui";
import { Icono } from "../comunes/componentes/Iconos";

// RF-003 / HU-06: consulta de servicios de Desarrollo Humano / Orientación.
export function ServiciosPage() {
  const [servicios, setServicios] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    http
      .get("/servicios")
      .then((res) => setServicios(res.data.servicios))
      .catch(() => setError("No fue posible cargar los servicios. Intenta de nuevo más tarde."));
  }, []);

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 lg:pt-10 pb-16 [&>*]:max-w-4xl">
      <h1 className="m-0 font-sans text-[32px] sm:text-[40px] leading-[1.05] tracking-[-0.035em] font-extrabold text-primary-dark">Servicios de Desarrollo Humano</h1>
      <p className="mt-1.5 mb-7 text-ink-500 max-w-[620px]">
        Consulta la oferta de orientación disponible para la comunidad institucional.
      </p>

      {error && (
        <div className="mb-6">
          <Aviso>{error}</Aviso>
        </div>
      )}

      {!servicios && !error && <Esqueleto etiqueta="Cargando servicios…" />}

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

      {servicios?.length > 0 && (
        <ul className="list-none m-0 p-0 bg-white border border-gray-200 rounded-xl divide-y divide-gray-200">
          {servicios.map((servicio) => (
            <li key={servicio.id} className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8">
              <div className="flex-1 min-w-0">
                <h2 className="m-0 font-sans text-lg font-bold text-primary">{servicio.nombre}</h2>
                {servicio.descripcion && (
                  <p className="mt-1 mb-0 text-[15px] leading-relaxed text-ink-600 max-w-[60ch]">{servicio.descripcion}</p>
                )}
              </div>
              <Link
                to={`/estudiante/agendar?servicio=${servicio.id}`}
                className="self-start sm:self-center inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full burbuja text-primary font-bold text-sm whitespace-nowrap hover:bg-white"
              >
                Ver horarios
                <Icono nombre="flecha" size={17} strokeWidth={2.2} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
