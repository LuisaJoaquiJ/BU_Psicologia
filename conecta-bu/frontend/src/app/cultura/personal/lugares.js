// Busca lugares por nombre en OpenStreetMap (Nominatim), con preferencia por Popayan.
async function consultarLugares(texto, senal) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    format: "jsonv2",
    q: texto,
    countrycodes: "co",
    limit: "5",
    "accept-language": "es",
    viewbox: "-76.75,2.60,-76.45,2.30", // Popayán y alrededores
  }).toString();
  const r = await fetch(url, { signal: senal });
  if (!r.ok) throw new Error("busqueda");
  const filas = await r.json();
  return filas.map((x) => ({
    latitud: Number(x.lat),
    longitud: Number(x.lon),
    nombre: String(x.name || x.display_name.split(",")[0]),
    detalle: x.display_name.split(",").slice(1, 4).join(",").trim(),
  }));
}

// Si el nombre solo no aparece, se intenta de nuevo dentro de Popayan.
export async function buscarLugares(texto, senal) {
  const directo = await consultarLugares(texto, senal);
  if (directo.length || /popay/i.test(texto)) return directo;
  return consultarLugares(`${texto}, Popayán`, senal);
}
