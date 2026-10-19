// Tarjeta de cada grafica del tablero de Deporte: titulo, subtitulo, accion
// opcional a la derecha y el contenido.
export function Panel({ titulo, subtitulo, accion, children, className = "" }) {
  return (
    <section className={`bg-white border border-gray-200 rounded-xl p-5 sm:p-6 min-w-0 flex flex-col ${className}`}>
      <div className="flex justify-between items-start gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="m-0 text-lg font-sans font-bold text-ink-900">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 mb-0 text-[13px] text-ink-500">{subtitulo}</p>}
        </div>
        {accion}
      </div>
      <div className="flex-1 flex flex-col">{children}</div>
    </section>
  );
}
