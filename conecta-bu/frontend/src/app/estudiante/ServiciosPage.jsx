import { useEffect, useState } from "react";
import { http } from "../../lib/api/http";

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
    <main className="max-w-6xl mx-auto p-6 lg:p-10">
      <h1 className="text-3xl font-semibold text-primary mb-1">Servicios de Desarrollo Humano</h1>
      <p className="text-gray-500 mb-8">
        Consulta la oferta de orientación disponible para la comunidad institucional.
      </p>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md p-3 mb-6">{error}</p>}

      {!servicios && !error && <p className="text-gray-500">Cargando servicios...</p>}

      {servicios && servicios.length === 0 && (
        <p className="text-gray-500">Por ahora no hay servicios publicados.</p>
      )}

      <div className="grid sm:grid-cols-2 gap-5">
        {servicios?.map((servicio) => (
          <div key={servicio.id} className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-ink-900">{servicio.nombre}</h2>
            <p className="text-sm text-gray-500 mt-2">{servicio.descripcion}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
