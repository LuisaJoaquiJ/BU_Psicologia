import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Encabezado, Insignia, Vacio, botonSecundario, claseCampo, claseCampoCorto } from "../../comunes/componentes/ui";
import { Icono } from "../../comunes/componentes/Iconos";
import { BotonFlotante, Ventana } from "../../comunes/componentes/Ventana";
import { http } from "../../../../lib/api/http";
import { horas } from "../../comunes/lib/deporte";
import { useCatalogosDeporte } from "../../comunes/useCatalogosDeporte";
import { ReconocerDesdeLista } from "./FormularioHoras";
import { descargarReporte } from "../inicio/InicioPersonal";

// Estudiantes y su avance hacia las horas requeridas.

export function EstudiantesPage() {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [categoria, setCategoria] = useState("");
  const [datos, setDatos] = useState(null);
  const [reconociendo, setReconociendo] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const { cat } = useCatalogosDeporte();
  useEffect(() => {
    const t = setTimeout(() => {
      http.get("/deporte/admin/estudiantes", { params: { q: q || undefined, estado: estado || undefined, categoria: categoria || undefined } }).then((r) => setDatos(r.data));
    }, 250);
    return () => clearTimeout(t);
  }, [q, estado, categoria, recarga]);
  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-28">
      {!reconociendo && <BotonFlotante onClick={() => setReconociendo(true)}>Reconocer horas</BotonFlotante>}
      {reconociendo && (
        <Ventana titulo="Reconocer horas" alCerrar={() => setReconociendo(false)} ancho="sm:max-w-[720px]">
          <ReconocerDesdeLista
            cat={cat}
            onCerrar={() => setReconociendo(false)}
            onGuardado={() => {
              setReconociendo(false);
              setRecarga((n) => n + 1);
            }}
          />
        </Ventana>
      )}
      <Encabezado
        kicker="Deporte"
        titulo="Estudiantes y horas"
        descripcion={`Avance de cada estudiante hacia las ${datos?.requeridas || 40} horas requeridas. Busca a cualquier estudiante por nombre o correo para reconocerle horas por torneos o eventos.`}
        acciones={
          <button type="button" onClick={() => descargarReporte()} className={botonSecundario}>
            <Icono nombre="descarga" size={16} /> Excel
          </button>
        }
      />
      <div className="flex gap-2.5 flex-wrap mb-5">
        <label className="relative flex-[1_1_260px]">
          <span className="sr-only">Buscar</span>
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">
            <Icono nombre="buscar" size={18} />
          </span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o correo" className={`${claseCampo} pl-10`} />
        </label>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className={claseCampoCorto} aria-label="Estado">
          <option value="">Todos</option>
          <option value="pendientes">En curso</option>
          <option value="cumplieron">Completaron</option>
        </select>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={claseCampoCorto} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          <option>Pregrado</option>
          <option>Posgrado</option>
          <option>Egresado</option>
        </select>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {datos?.estudiantes.length === 0 && (
          <div className="p-5">
            <Vacio>No hay estudiantes con estos filtros.</Vacio>
          </div>
        )}
        <ul className="list-none m-0 p-0">
          {datos?.estudiantes.map((e) => (
            <li key={e.id} className="border-t border-gray-100 first:border-t-0">
              <Link to={`/deporte/estudiantes/${e.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 flex-wrap">
                <span className="flex-[1_1_220px] min-w-0 leading-tight">
                  <span className="block font-semibold text-ink-900 truncate">{e.nombre}</span>
                  <span className="block text-xs text-ink-500 truncate">
                    {e.categoria} · {e.email}
                    {e.gruposActivos.length ? ` · ${e.gruposActivos.join(", ")}` : ""}
                  </span>
                </span>
                <span className="flex-[1_1_200px] max-w-[280px]">
                  <span className="block h-2 rounded-full bg-gray-100 overflow-hidden">
                    <span className={`block h-full rounded-full ${e.cumplido ? "bg-[#0d9488]" : "bg-gold"}`} style={{ width: `${e.porcentaje}%` }} />
                  </span>
                  <span className="block text-xs text-ink-500 mt-1">
                    {horas(e.total)} de {datos.requeridas} · este periodo {horas(e.horasPeriodo)}
                  </span>
                </span>
                {e.cumplido ? <Insignia tono="verde">Completó</Insignia> : <Insignia tono="gris">{e.porcentaje} %</Insignia>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
