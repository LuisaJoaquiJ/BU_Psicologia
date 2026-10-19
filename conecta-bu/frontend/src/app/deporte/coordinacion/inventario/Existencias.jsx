// Barra de existencias de un implemento (disponibles, prestados y dañados).

export const enDias = (n) => new Date(Date.now() - 5 * 3600e3 + n * 864e5).toISOString().slice(0, 10);

// Barra apilada: disponibles / en prestamo / danados.
export function BarraExistencias({ i }) {
  const total = Math.max(1, i.cantidadTotal);
  const partes = [
    [i.disponibles, "bg-[#0d9488]", "disponibles"],
    [i.enPrestamo, "bg-[#2a78d6]", "en préstamo"],
    [i.cantidadDanada, "bg-[#d97706]", "dañados"],
  ];
  return (
    <div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex" title={partes.map(([n, , t]) => `${n} ${t}`).join(" · ")}>
        {partes.map(([n, c, t]) => (n > 0 ? <div key={t} className={`h-full ${c}`} style={{ width: `${(n / total) * 100}%` }} /> : null))}
      </div>
      <p className="m-0 mt-1 text-xs text-ink-500">
        <strong className="text-ink-900">{i.disponibles}</strong> disponibles · {i.enPrestamo} prestados · {i.cantidadDanada} dañados
      </p>
    </div>
  );
}

export const LEYENDA = (
  <ul className="list-none m-0 p-0 flex gap-4 flex-wrap text-xs text-ink-600">
    {[
      ["bg-[#0d9488]", "Disponibles"],
      ["bg-[#2a78d6]", "En préstamo"],
      ["bg-[#d97706]", "Dañados"],
    ].map(([c, t]) => (
      <li key={t} className="inline-flex items-center gap-1.5">
        <span className={`w-2.5 h-2.5 rounded-full ${c}`} />
        {t}
      </li>
    ))}
  </ul>
);
