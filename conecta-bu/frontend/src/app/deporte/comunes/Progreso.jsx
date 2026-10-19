import { Icono } from "./componentes/Iconos";
import { Anillo, BarrasH } from "../../../components/graficas/Tablero";
import { estiloDisciplina, horas } from "./lib/deporte";
import { urlDelServidor } from "./lib/imagenes";

// Piezas de avance: anillo de horas, icono o foto de la disciplina y horas por disciplina.

// Anillo de avance de horas (sobre fondo azul), con Recharts.
export function AnilloHoras({ total, requeridas, tamano = 168 }) {
  const avance = requeridas ? (total / requeridas) * 100 : 0;
  return (
    <Anillo porcentaje={avance} color="#7FE8FF" pista="rgba(255,255,255,0.14)" tamano={tamano} grosor={12} etiqueta={`${total} de ${requeridas} horas`}>
      <span className="font-display text-[40px] leading-none font-semibold text-white tabular-nums">{Number(total).toLocaleString("es-CO", { maximumFractionDigits: 1 })}</span>
      <span className="text-[13px] text-[#D6DDEC] mt-1">de {requeridas} horas</span>
    </Anillo>
  );
}

// Chip con icono de la disciplina.
// Con "imagen" (foto de la disciplina) muestra la foto en lugar del icono.
export function IconoDisciplina({ nombre, tamano = 44, imagen }) {
  const e = estiloDisciplina(nombre);
  if (imagen) return <img src={urlDelServidor(imagen)} alt="" className="rounded-2xl object-cover shrink-0 bg-gray-100" style={{ width: tamano, height: tamano }} />;
  return (
    <span className="rounded-2xl flex items-center justify-center shrink-0" style={{ width: tamano, height: tamano, background: e.fondo, color: e.color }}>
      <Icono nombre={e.icono} size={Math.round(tamano * 0.5)} strokeWidth={2} />
    </span>
  );
}

// Horas por disciplina (Recharts, barras horizontales con el color de cada disciplina).
export function BarrasDisciplina({ datos, formato = horas }) {
  return (
    <BarrasH
      filas={datos.map((d) => ({ id: d.nombre, nombre: d.nombre, total: d.horas }))}
      colores={Object.fromEntries(datos.map((d) => [d.nombre, estiloDisciplina(d.nombre).color]))}
      formato={formato}
    />
  );
}
