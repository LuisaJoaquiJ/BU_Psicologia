import { useState } from "react";
import {
  AreaTiempo,
  BarrasAgrupadas,
  BarrasH,
  Columnas,
  ColumnasApiladas,
  Dona,
  Leyenda,
  LineasMensuales,
  Pastel,
  PALETA,
  RadarComparado,
  SERIES_MODULOS,
  VerDatos,
} from "./Tablero";

// Galeria de las graficas con datos de ejemplo (solo en desarrollo:
// http://localhost:5173/dev/graficas). Sirve para ver cada tipo sin iniciar
// sesion ni tener datos en la base, y para elegir cual usar en un tablero.

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct"];
const TENDENCIA = MESES.map((etiqueta, i) => ({
  etiqueta,
  "desarrollo-humano": 40 + Math.round(18 * Math.sin(i / 1.7)) + i * 3,
  salud: 30 + Math.round(12 * Math.cos(i / 2)) + i * 2,
  deporte: 20 + (i % 4) * 6 + i,
}));
const SERVICIOS = [
  { id: "psico", nombre: "Orientación psicológica", total: 64, atendidas: 51 },
  { id: "voc", nombre: "Orientación vocacional", total: 38, atendidas: 33 },
  { id: "acad", nombre: "Acompañamiento académico", total: 29, atendidas: 20 },
  { id: "fam", nombre: "Asesoría familiar", total: 12, atendidas: 11 },
];
const SERIES_SERVICIO = [
  { clave: "total", etiqueta: "Citas pedidas", color: "#2a78d6" },
  { clave: "atendidas", etiqueta: "Atendidas", color: "#0d9488" },
];
const POBLACION = [
  { clave: "est", etiqueta: "Estudiantes", valor: 412 },
  { clave: "doc", etiqueta: "Docentes", valor: 96 },
  { clave: "adm", etiqueta: "Administrativos", valor: 71 },
  { clave: "egr", etiqueta: "Egresados", valor: 23 },
  { clave: "ext", etiqueta: "Externos", valor: 9 },
];
const ESTADOS = [
  { clave: "Atendida", etiqueta: "Asistieron", color: "#0d9488", valor: 118 },
  { clave: "NoAsistio", etiqueta: "No asistieron", color: "#d97706", valor: 21 },
  { clave: "Agendada", etiqueta: "Por atender", color: "#163F86", valor: 34 },
  { clave: "Cancelada", etiqueta: "Canceladas", color: "#CBD2DE", valor: 15 },
];
const DISCIPLINAS = [
  { id: "fut", nombre: "Fútbol", ocupacion: 92, asistencia: 78 },
  { id: "nat", nombre: "Natación", ocupacion: 60, asistencia: 88 },
  { id: "bal", nombre: "Baloncesto", ocupacion: 75, asistencia: 64 },
  { id: "vol", nombre: "Voleibol", ocupacion: 48, asistencia: 81 },
  { id: "aje", nombre: "Ajedrez", ocupacion: 85, asistencia: 93 },
  { id: "dan", nombre: "Danza", ocupacion: 100, asistencia: 70 },
];
const PERFIL = [
  { clave: "ocupacion", etiqueta: "Cupos ocupados", color: "#2a78d6" },
  { clave: "asistencia", etiqueta: "Asistencia a clases", color: "#eb6834" },
];

function Tarjeta({ titulo, uso, children }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 min-w-0">
      <h2 className="m-0 text-lg font-bold text-ink-900">{titulo}</h2>
      <p className="mt-0.5 mb-4 text-[13px] text-ink-500">{uso}</p>
      {children}
    </section>
  );
}

export default function GaleriaGraficas() {
  const [apilada, setApilada] = useState(true);
  return (
    <main className="max-w-[1200px] mx-auto px-4 sm:px-8 py-10 flex flex-col gap-5">
      <header>
        <p className="m-0 text-sm font-semibold text-ink-500">Solo en desarrollo · src/components/graficas</p>
        <h1 className="m-0 text-3xl font-extrabold">Galería de gráficas</h1>
        <p className="mt-2 mb-0 text-ink-500 max-w-[720px]">
          Todas usan Recharts y la misma paleta validada para daltonismo: {PALETA.length} colores en orden fijo. Pasa el mouse sobre cualquier marca para ver su valor.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta titulo="Líneas" uso="LineasMensuales · comparar la tendencia de pocas series en el tiempo.">
          <div className="mb-3">
            <Leyenda series={SERIES_MODULOS} forma="linea" />
          </div>
          <LineasMensuales datos={TENDENCIA} series={SERIES_MODULOS} />
        </Tarjeta>
        <Tarjeta titulo="Área" uso="AreaTiempo · apilada muestra cuánto aporta cada serie al total; sin apilar, se superponen.">
          <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
            <Leyenda series={SERIES_MODULOS} />
            <label className="text-[13px] text-ink-600 flex items-center gap-2">
              <input type="checkbox" checked={apilada} onChange={(e) => setApilada(e.target.checked)} /> Apilada
            </label>
          </div>
          <AreaTiempo datos={TENDENCIA} series={SERIES_MODULOS} apilada={apilada} />
        </Tarjeta>
        <Tarjeta titulo="Columnas apiladas" uso="ColumnasApiladas · el total por periodo y de qué está hecho.">
          <div className="mb-3">
            <Leyenda series={SERIES_MODULOS} />
          </div>
          <ColumnasApiladas datos={TENDENCIA} partes={SERIES_MODULOS} />
        </Tarjeta>
        <Tarjeta titulo="Columnas" uso="Columnas · una sola serie con el valor encima de cada barra.">
          <Columnas filas={MESES.map((m, i) => ({ id: m, nombre: m, total: TENDENCIA[i].salud }))} color="#1baf7a" />
        </Tarjeta>
        <Tarjeta titulo="Barras horizontales" uso="BarrasH · ranking de categorías con nombres largos.">
          <BarrasH filas={SERVICIOS} />
        </Tarjeta>
        <Tarjeta titulo="Barras agrupadas" uso="BarrasAgrupadas · comparar dos o tres medidas por categoría.">
          <div className="mb-3">
            <Leyenda series={SERIES_SERVICIO} />
          </div>
          <BarrasAgrupadas filas={SERVICIOS} series={SERIES_SERVICIO} />
          <VerDatos columnas={["Servicio", "Pedidas", "Atendidas"]} filas={SERVICIOS.map((s) => [s.nombre, s.total, s.atendidas])} />
        </Tarjeta>
        <Tarjeta titulo="Pastel con porcentajes" uso="Pastel · parte de un todo, hasta 6 partes (las demás van a «Otros»).">
          <Pastel titulo="Atenciones por población" partes={POBLACION} />
        </Tarjeta>
        <Tarjeta titulo="Dona con porcentajes" uso="Dona porcentajes · como el pastel, con la cifra principal en el centro.">
          <Dona partes={ESTADOS} centro="63 %" etiquetaCentro="asistieron a su cita" porcentajes />
        </Tarjeta>
        <Tarjeta titulo="Radar" uso="RadarComparado · varias medidas en la misma escala (0–100 %) sobre 3 a 8 ejes.">
          <div className="mb-3">
            <Leyenda series={PERFIL} forma="linea" />
          </div>
          <RadarComparado ejes={DISCIPLINAS} series={PERFIL} />
        </Tarjeta>
        <Tarjeta titulo="Pastel con muchas partes" uso="Con más de 6 partes, las más pequeñas se agrupan en «Otros».">
          <Pastel
            titulo="Inscritos por disciplina"
            partes={DISCIPLINAS.concat([{ id: "ten", nombre: "Tenis" }, { id: "atl", nombre: "Atletismo" }]).map((d, i) => ({ clave: d.id, etiqueta: d.nombre, valor: 60 - i * 6 }))}
          />
        </Tarjeta>
      </div>
    </main>
  );
}
