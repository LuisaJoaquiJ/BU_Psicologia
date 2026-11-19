// Texto de las respuestas del asistente con markdown simple, sin librerías:
// viñetas («• », «- », «* »), pasos («1. »), **negritas**, *cursiva* o _cursiva_
// y saltos de línea. Los correos salen como enlace mailto: y, en la respuesta
// de crisis, la línea de apoyo como enlace tel:. El aviso de privacidad se ve
// pequeño, discreto y en cursiva.

const CORREO = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function patronEnLinea(linea) {
  const partes = [
    "\\*\\*[^*\\n]+\\*\\*", // **negrita**
    "(?<![\\w*])\\*(?!\\s)[^*\\n]+?\\*(?![\\w*])", // *cursiva*
    "(?<![\\w])_(?!\\s)[^_\\n]+?_(?![\\w])", // _cursiva_
    CORREO.source,
  ];
  if (linea) partes.push(`(?<![\\w+])${escapar(linea)}(?![\\w])`);
  return new RegExp(`(${partes.join("|")})`, "g");
}

function enLinea(texto, opciones) {
  const { crisis, linea } = opciones;
  const partes = String(texto).split(patronEnLinea(crisis ? linea : null));
  return partes.map((parte, i) => {
    if (!parte) return null;
    if (/^\*\*[^*]+\*\*$/.test(parte)) return <strong key={i} className="font-bold">{enLinea(parte.slice(2, -2), opciones)}</strong>;
    if (/^\*[^*]+\*$/.test(parte) || /^_[^_]+_$/.test(parte)) return <em key={i}>{enLinea(parte.slice(1, -1), opciones)}</em>;
    if (new RegExp(`^${CORREO.source}$`).test(parte)) {
      return (
        <a key={i} href={`mailto:${parte}`} className={`font-bold underline underline-offset-2 break-all ${crisis ? "text-rose-800" : "text-primary"}`}>
          {parte}
        </a>
      );
    }
    if (crisis && linea && parte === linea) {
      return (
        <a key={i} href={`tel:${linea.replace(/[^\d+]/g, "")}`} className="font-black underline underline-offset-2 text-rose-800">
          {linea}
        </a>
      );
    }
    return <span key={i}>{parte}</span>;
  });
}

const VINETA = /^\s*[•\-*]\s+(.*)$/;
const PASO = /^\s*(\d+)[.)]\s+(.*)$/;
const NOTA = /^[_*]*\s*Nota:\s*Tus mensajes son confidenciales/i;

export function AsistenteTexto({ texto, crisis = false, linea = "123" }) {
  const opciones = { crisis, linea: String(linea || "123") };
  const lineas = String(texto || "").split(/\r?\n/);
  const bloques = [];
  for (const fila of lineas) {
    const limpia = fila.trim();
    const esNota = NOTA.test(limpia);
    const vineta = !esNota && fila.match(VINETA);
    const paso = !esNota && fila.match(PASO);
    const ultimo = bloques[bloques.length - 1];
    if (vineta) {
      if (ultimo?.tipo === "ul") ultimo.items.push(vineta[1]);
      else bloques.push({ tipo: "ul", items: [vineta[1]] });
    } else if (paso) {
      if (ultimo?.tipo === "ol") ultimo.items.push(paso[2]);
      else bloques.push({ tipo: "ol", inicio: Number(paso[1]) || 1, items: [paso[2]] });
    } else if (limpia) {
      bloques.push(esNota ? { tipo: "nota", texto: limpia.replace(/^[_*]+|[_*]+$/g, "") } : { tipo: "p", texto: limpia });
    }
  }

  return (
    <div className="flex flex-col gap-2 leading-relaxed">
      {bloques.map((b, i) => {
        if (b.tipo === "ul") {
          return (
            <ul key={i} className="m-0 pl-5 list-disc flex flex-col gap-1 marker:text-primary">
              {b.items.map((item, j) => <li key={j}>{enLinea(item, opciones)}</li>)}
            </ul>
          );
        }
        if (b.tipo === "ol") {
          return (
            <ol key={i} start={b.inicio} className="m-0 pl-5 list-decimal flex flex-col gap-1 marker:font-bold marker:text-primary">
              {b.items.map((item, j) => <li key={j}>{enLinea(item, opciones)}</li>)}
            </ol>
          );
        }
        if (b.tipo === "nota") {
          return (
            <p key={i} className="m-0 mt-1 pt-2 border-t border-[#1E3A5F]/10 text-[11px] italic leading-snug text-[#6B7A8D]">
              {b.texto}
            </p>
          );
        }
        return <p key={i} className="m-0">{enLinea(b.texto, opciones)}</p>;
      })}
    </div>
  );
}
