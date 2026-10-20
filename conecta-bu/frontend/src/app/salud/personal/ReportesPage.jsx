import { useEffect, useRef, useState } from "react";
import { http } from "../../../lib/api/http";
import { Icono } from "../comunes/componentes/Iconos";
import { descargar, hoyISO, mensajeError, refrescarCatalogos, useCatalogos } from "../comunes/lib/salud";
import { Aviso, Campo, Encabezado, Tarjeta, botonDorado, botonPrimario, botonSecundario, claseCampo } from "../comunes/componentes/ui";

function TarjetaReporte({ icono, titulo, reemplaza, descripcion, children, onDescargar }) {
  const [estado, setEstado] = useState("");
  const [aviso, setAviso] = useState("");
  async function ejecutar() {
    setEstado("generando");
    setAviso("");
    try {
      const res = await onDescargar();
      const sinResponsable = res?.headers?.["x-actividades-sin-responsable"];
      if (sinResponsable) setAviso(`${sinResponsable} actividad(es) no tienen documento del responsable: complétalo en Actividades para la hoja de recurso humano.`);
      setEstado("");
    } catch {
      setEstado("error");
    }
  }
  return (
    <Tarjeta className="flex flex-col">
      <div className="flex gap-4 items-start">
        <span className="w-12 h-12 rounded-2xl bg-primary-light text-primary-soft flex items-center justify-center shrink-0">
          <Icono nombre={icono} size={24} />
        </span>
        <div className="min-w-0">
          <h2 className="m-0 font-sans text-lg font-bold text-primary-dark">{titulo}</h2>
          <p className="m-0 mt-0.5 text-xs font-bold uppercase tracking-wide text-accent">Reemplaza: {reemplaza}</p>
        </div>
      </div>
      <p className="mt-3 mb-4 text-sm text-ink-600 leading-relaxed">{descripcion}</p>
      <div className="mt-auto flex flex-col gap-3">
        {children}
        <button type="button" onClick={ejecutar} disabled={estado === "generando"} className={`${botonPrimario} self-start`}>
          <Icono nombre="descarga" size={18} strokeWidth={2.2} />
          {estado === "generando" ? "Generando..." : "Descargar Excel"}
        </button>
        {estado === "error" && <Aviso>No fue posible generar el archivo. Intenta de nuevo.</Aviso>}
        {aviso && <Aviso tono="dorado">{aviso}</Aviso>}
      </div>
    </Tarjeta>
  );
}

function Importador() {
  const [archivo, setArchivo] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const input = useRef(null);

  async function enviar(confirmar) {
    if (!archivo) return;
    setOcupado(true);
    setError("");
    const datos = new FormData();
    datos.append("archivo", archivo);
    try {
      const { data } = await http.post(`/salud/importar${confirmar ? "?confirmar=true" : ""}`, datos);
      if (confirmar) {
        setResultado(data);
        setPrevia(null);
        refrescarCatalogos();
      } else setPrevia(data);
    } catch (err) {
      setError(mensajeError(err, "No fue posible leer el archivo."));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Tarjeta
      titulo="Importar los Excel que ya tienen"
      subtitulo="Registro general (SPADIEZ) o formulario de atención de enfermería. Crea a las personas para buscarlas por documento y carga su historial. Puedes subir el mismo archivo otra vez: no se duplica nada."
    >
      <div className="flex gap-3 flex-wrap items-center">
        <button type="button" onClick={() => input.current?.click()} className={botonSecundario}>
          <Icono nombre="subir" size={17} strokeWidth={2.2} />
          {archivo ? "Cambiar archivo" : "Elegir archivo .xlsx"}
        </button>
        {archivo && <span className="text-sm font-semibold text-ink-900">{archivo.name}</span>}
        <input
          ref={input}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => {
            setArchivo(e.target.files[0] || null);
            setPrevia(null);
            setResultado(null);
            e.target.value = "";
          }}
        />
        {archivo && !previa && (
          <button type="button" onClick={() => enviar(false)} disabled={ocupado} className={botonPrimario}>
            {ocupado ? "Leyendo..." : "Revisar antes de importar"}
          </button>
        )}
      </div>

      {error && <div className="mt-4"><Aviso>{error}</Aviso></div>}

      {previa && (
        <div className="mt-5 flex flex-col gap-4">
          <p className="m-0 text-sm text-ink-600">
            Formato reconocido: <strong className="text-ink-900">{previa.formato}</strong> (hoja «{previa.hoja}»).
          </p>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
            {[
              ["Atenciones a importar", previa.atenciones],
              ["Personas nuevas", previa.personasNuevas],
              ["Personas que ya existían", previa.personasExistentes],
              ["Actividades nuevas", previa.actividadesNuevas.length],
            ].map(([t, v]) => (
              <div key={t} className="bg-gray-50 rounded-2xl p-4">
                <p className="m-0 text-xs text-ink-500">{t}</p>
                <p className="m-0 mt-1 font-display text-3xl font-semibold text-primary tabular-nums">{v.toLocaleString("es-CO")}</p>
              </div>
            ))}
          </div>
          <p className="m-0 text-sm text-ink-600">Periodos: {previa.periodos.join(", ")}.</p>
          {previa.fechasCorregidas > 0 && (
            <Aviso tono="azul">{previa.fechasCorregidas} fechas tenían el día y el mes invertidos (por ejemplo, 2 de noviembre en lugar de 11 de febrero) y se corrigieron.</Aviso>
          )}
          {previa.filasOmitidas > 0 && (
            <Aviso tono="dorado">
              <p className="m-0 mb-1.5">
                <strong>{previa.filasOmitidas} filas no se importarán</strong>; revísalas en el Excel:
              </p>
              <ul className="m-0 pl-5">
                {Object.entries(previa.motivosOmision).map(([m, n]) => (
                  <li key={m}>
                    {m}: {n}
                  </li>
                ))}
              </ul>
              {previa.advertencias.length > 0 && (
                <p className="m-0 mt-1.5 text-xs">Filas: {previa.advertencias.map((a) => a.fila).join(", ")}{previa.filasOmitidas > previa.advertencias.length ? "…" : ""}</p>
              )}
            </Aviso>
          )}
          {previa.actividadesNuevas.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-primary">Ver actividades que se crearán ({previa.actividadesNuevas.length})</summary>
              <ul className="mt-2 mb-0 pl-5 text-ink-600 columns-1 sm:columns-2">
                {previa.actividadesNuevas.map((a) => (
                  <li key={`${a.periodo}-${a.nombre}`}>
                    {a.nombre} <span className="text-ink-500">({a.periodo})</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex gap-2.5 flex-wrap">
            <button type="button" onClick={() => enviar(true)} disabled={ocupado} className={botonDorado}>
              {ocupado ? "Importando..." : `Importar ${previa.atenciones.toLocaleString("es-CO")} atenciones`}
            </button>
            <button type="button" onClick={() => setPrevia(null)} className={botonSecundario}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {resultado && (
        <div className="mt-5">
          <Aviso tono="verde">
            <strong>Importación lista.</strong> {resultado.importadas.toLocaleString("es-CO")} atenciones nuevas
            {resultado.duplicadasOmitidas ? `, ${resultado.duplicadasOmitidas.toLocaleString("es-CO")} ya estaban cargadas` : ""}, {resultado.personasNuevas.toLocaleString("es-CO")} personas
            nuevas y {resultado.actividadesCreadas} actividades creadas. Las personas importadas autorizarán el tratamiento de datos en su próxima atención.
          </Aviso>
        </div>
      )}
    </Tarjeta>
  );
}

// Reportes que reemplazan los Excel de la Unidad de Salud e importador.
export function ReportesPage() {
  const catalogos = useCatalogos();
  const [periodo, setPeriodo] = useState("");
  const [rango, setRango] = useState({ desde: "", hasta: hoyISO() });

  useEffect(() => {
    if (catalogos && !periodo) setPeriodo(catalogos.periodoActual);
  }, [catalogos, periodo]);

  const selectorPeriodo = (
    <Campo etiqueta="Periodo">
      <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={claseCampo}>
        {(catalogos?.periodos || [periodo]).filter(Boolean).map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </Campo>
  );

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16 flex flex-col gap-6">
      <Encabezado
        kicker="Salud integral"
        titulo="Reportes"
        descripcion="Los formatos que antes se llenaban a mano salen listos desde los registros. Contienen datos personales y de salud: compártelos solo por los canales institucionales."
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <TarjetaReporte
          icono="grafica"
          titulo="Informe de gestión"
          reemplaza="INFBI-002"
          descripcion="Proyecto, evaluación, matriz de atendidos con meta, logro y semáforo, estadísticas con gráficas frente a años anteriores y registro fotográfico. Para escribir los textos, verlo en PDF y enviarlo al superadministrador, usa «Informe de gestión»."
          onDescargar={() => descargar("/salud/reportes/gestion", { periodo }, `informe-gestion-salud-${periodo}.xlsx`)}
        >
          {selectorPeriodo}
        </TarjetaReporte>
        <TarjetaReporte
          icono="archivo"
          titulo="Reporte SNIES"
          reemplaza="Plantilla 92 · Actividad de bienestar"
          descripcion="Las hojas ACTIVIDAD_BIENESTAR, ACT_BIENESTAR_BENEFICIARIOS y ACT_BIENESTAR_REC_HUMANO con los códigos del periodo, listas para cargar."
          onDescargar={() => descargar("/salud/reportes/snies", { periodo }, `SNIES-salud-integral-${periodo}.xlsx`)}
        >
          {selectorPeriodo}
        </TarjetaReporte>
        <TarjetaReporte
          icono="lista"
          titulo="Registro de atenciones"
          reemplaza="SPADIEZ y formulario de enfermería"
          descripcion="Todas las atenciones con el formato del registro general, más una hoja con los signos vitales e insumos de enfermería."
          onDescargar={() => descargar("/salud/reportes/registro", { desde: rango.desde || undefined, hasta: rango.hasta || undefined }, "registro-salud.xlsx")}
        >
          <div className="grid gap-3 grid-cols-2">
            <Campo etiqueta="Desde">
              <input type="date" value={rango.desde} onChange={(e) => setRango({ ...rango, desde: e.target.value })} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Hasta">
              <input type="date" value={rango.hasta} onChange={(e) => setRango({ ...rango, hasta: e.target.value })} className={claseCampo} />
            </Campo>
          </div>
        </TarjetaReporte>
      </div>
      <Importador />
    </main>
  );
}
