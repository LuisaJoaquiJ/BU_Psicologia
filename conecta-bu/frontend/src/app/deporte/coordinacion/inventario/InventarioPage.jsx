import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Aviso, Campo, Encabezado, Insignia, Kpi, Tarjeta, Vacio, botonPrimario, botonSecundario, claseCampo, claseCampoCorto } from "../../comunes/componentes/ui";
import { useConfirmar } from "../../comunes/componentes/Confirmar";
import { Icono } from "../../comunes/componentes/Iconos";
import { SelectorFoto, fotoInicial, guardarFoto } from "../../comunes/componentes/SelectorFoto";
import { BotonFlotante, Ventana } from "../../comunes/componentes/Ventana";
import { http } from "../../../../lib/api/http";
import { descargar, mensajeError } from "../../comunes/lib/salud";
import { Pastillas } from "../../comunes/Pastillas";
import { IconoDisciplina } from "../../comunes/Progreso";
import { CONTENEDOR } from "../../comunes/estilos";
import { useCatalogosDeporte } from "../../comunes/useCatalogosDeporte";
import { BarraExistencias, LEYENDA } from "./Existencias";
import { FilaPrestamo } from "./Prestamos";

// Inventario de implementos: existencias, filtros y préstamos activos.

const NUEVO = { nombre: "", codigo: "", disciplinaId: "", ubicacion: "", cantidad: 1, stockMinimo: 0, descripcion: "" };

export function InventarioPage() {
  const { cat } = useCatalogosDeporte();
  const [datos, setDatos] = useState(null);
  const [pestana, setPestana] = useState("implementos");
  const [filtro, setFiltro] = useState("activos");
  const [q, setQ] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [nuevo, setNuevo] = useState(null);
  const [fotoNueva, setFotoNueva] = useState(() => fotoInicial(null));
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const navigate = useNavigate();
  const { confirmar, avisar } = useConfirmar();
  const cargar = useCallback(() => http.get("/deporte/admin/inventario").then((r) => setDatos(r.data)), []);
  useEffect(() => {
    cargar().catch((err) => setError(mensajeError(err, "No fue posible cargar el inventario.")));
  }, [cargar]);

  const lista = useMemo(() => {
    const l = datos?.implementos || [];
    return l
      .filter((i) => (filtro === "activos" ? i.activo : filtro === "bajo" ? i.bajoStock : filtro === "danados" ? i.cantidadDanada > 0 : !i.activo))
      .filter((i) => !disciplina || i.disciplinaId === disciplina)
      .filter((i) => !q || `${i.nombre} ${i.codigo || ""} ${i.ubicacion || ""}`.toLowerCase().includes(q.toLowerCase()));
  }, [datos, filtro, q, disciplina]);
  const conteos = useMemo(() => {
    const l = datos?.implementos || [];
    return { activos: l.filter((i) => i.activo).length, bajo: l.filter((i) => i.bajoStock).length, danados: l.filter((i) => i.cantidadDanada > 0).length, inactivos: l.filter((i) => !i.activo).length };
  }, [datos]);
  const r = datos?.resumen;

  return (
    <main className={`${CONTENEDOR} flex flex-col gap-6`}>
      <Encabezado
        kicker="Deporte"
        titulo="Inventario de implementos"
        descripcion="Balones, conos, petos, cronómetros… Lleva las existencias, los préstamos y su devolución, con el registro de cada movimiento."
        acciones={
          <>
            <button type="button" onClick={() => descargar("/deporte/admin/inventario/reporte", {}, "inventario-deporte.xlsx")} className={botonSecundario}>
              <Icono nombre="descarga" size={16} /> Excel
            </button>
          </>
        }
      />
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        <Kpi destacado titulo="Unidades disponibles" valor={r ? r.disponibles : "…"} detalle={r ? `de ${r.unidades} en ${r.referencias} implementos` : null} />
        <Kpi titulo="En préstamo" valor={r ? r.enPrestamo : "…"} detalle={r ? `${r.prestamosActivos} préstamo${r.prestamosActivos === 1 ? "" : "s"} activo${r.prestamosActivos === 1 ? "" : "s"}` : null} />
        <Kpi titulo="Préstamos vencidos" valor={r ? r.prestamosVencidos : "…"} detalle="sin devolver a tiempo" />
        <Kpi titulo="Bajo stock" valor={r ? r.bajoStock : "…"} detalle={r ? `${r.danados} unidades dañadas` : null} />
      </div>

      {!nuevo && (
        <BotonFlotante
          onClick={() => {
            setNuevo(NUEVO);
            setFotoNueva(fotoInicial(null));
          }}
        >
          Nuevo implemento
        </BotonFlotante>
      )}
      {nuevo && (
        <Ventana titulo="Nuevo implemento" alCerrar={() => setNuevo(null)} ancho="sm:max-w-[900px]">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              if (
                !(await confirmar({
                  titulo: "¿Registrar este implemento?",
                  detalle: [["Implemento", nuevo.nombre], ["Código", nuevo.codigo?.toUpperCase()], ["Ubicación", nuevo.ubicacion], ["Cantidad inicial", nuevo.cantidad], ["Stock mínimo", nuevo.stockMinimo || 0], ["Foto", fotoNueva.archivo ? fotoNueva.archivo.name : "Sin foto"]],
                  boton: "Sí, registrar",
                }))
              )
                return;
              try {
                const res = await http.post("/deporte/admin/inventario", { ...nuevo, cantidad: Number(nuevo.cantidad), stockMinimo: Number(nuevo.stockMinimo || 0) });
                const fallo = await guardarFoto(`/deporte/admin/inventario/${res.data.implemento.id}/imagen`, fotoNueva, null);
                avisar(`${nuevo.nombre} quedó en el inventario.${fallo ? ` ${fallo}` : ""}`, fallo ? "error" : "exito");
                navigate(`/deporte/inventario/${res.data.implemento.id}`);
              } catch (err) {
                setError(mensajeError(err, "No fue posible guardar."));
              }
            }}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <Campo etiqueta="Nombre" className="sm:col-span-2">
              <input required maxLength={120} value={nuevo.nombre} onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))} placeholder="Balón de voleibol Molten" className={claseCampo} />
            </Campo>
            <Campo etiqueta="Código (opcional)">
              <input maxLength={30} value={nuevo.codigo} onChange={(e) => setNuevo((n) => ({ ...n, codigo: e.target.value }))} placeholder="VOL-01" className={claseCampo} />
            </Campo>
            <Campo etiqueta="Disciplina (opcional)">
              <select value={nuevo.disciplinaId} onChange={(e) => setNuevo((n) => ({ ...n, disciplinaId: e.target.value }))} className={claseCampo}>
                <option value="">General</option>
                {cat?.disciplinas.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Ubicación">
              <input maxLength={120} value={nuevo.ubicacion} onChange={(e) => setNuevo((n) => ({ ...n, ubicacion: e.target.value }))} placeholder="Bodega del coliseo" className={claseCampo} />
            </Campo>
            <Campo etiqueta="Cantidad inicial">
              <input type="number" min="0" required value={nuevo.cantidad} onChange={(e) => setNuevo((n) => ({ ...n, cantidad: e.target.value }))} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Stock mínimo" ayuda="Avisa cuando queden estos o menos">
              <input type="number" min="0" value={nuevo.stockMinimo} onChange={(e) => setNuevo((n) => ({ ...n, stockMinimo: e.target.value }))} className={claseCampo} />
            </Campo>
            <div className="sm:col-span-2 lg:col-span-4">
              <SelectorFoto foto={fotoNueva} onCambio={setFotoNueva} etiqueta="Foto (opcional)" ayuda="Ayuda a reconocerlo al prestarlo. JPG, PNG o WEBP, hasta 5 MB." />
            </div>
            <div className="flex gap-2 items-end sm:col-span-2 lg:col-span-4">
              <button type="submit" className={botonPrimario}>
                Guardar
              </button>
              <button type="button" onClick={() => setNuevo(null)} className={botonSecundario}>
                Cancelar
              </button>
            </div>
          </form>
        </Ventana>
      )}

      <Pastillas
        etiqueta="Vista"
        opciones={[["implementos", "Implementos"], ["prestamos", "Préstamos activos"]]}
        valor={pestana}
        onCambio={setPestana}
        conteos={{ implementos: conteos.activos, prestamos: datos?.prestamos.length ?? 0 }}
      />

      {pestana === "implementos" ? (
        <>
          <div className="flex flex-wrap gap-3 items-center">
            <Pastillas etiqueta="Filtrar" opciones={[["activos", "Todos"], ["bajo", "Bajo stock"], ["danados", "Con dañados"], ["inactivos", "Inactivos"]]} valor={filtro} onCambio={setFiltro} conteos={conteos} />
            <select value={disciplina} onChange={(e) => setDisciplina(e.target.value)} aria-label="Disciplina" className={claseCampoCorto}>
              <option value="">Todas las disciplinas</option>
              {cat?.disciplinas.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
            <label className="relative flex-[1_1_220px] max-w-sm">
              <span className="sr-only">Buscar implemento</span>
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">
                <Icono nombre="buscar" size={18} />
              </span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, código o ubicación" className={`${claseCampo} pl-10`} />
            </label>
          </div>
          {LEYENDA}
          {!datos && <p className="text-ink-500">Cargando…</p>}
          {datos && lista.length === 0 && <Vacio>{datos.implementos.length ? "Ningún implemento con estos filtros." : "Aún no hay implementos. Registra el primero con «Nuevo implemento»."}</Vacio>}
          <ul className="list-none m-0 p-0 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {lista.map((i) => (
              <li key={i.id} className="min-w-0">
                <Link to={`/deporte/inventario/${i.id}`} className={`bg-white border rounded-xl p-4 flex flex-col gap-3 no-underline hover:border-primary-soft ${i.bajoStock ? "border-[#F2C46D]" : "border-gray-200"}`}>
                  <span className="flex gap-3 items-start">
                    <IconoDisciplina nombre={i.disciplina || i.nombre} tamano={i.imagenUrl ? 64 : 40} imagen={i.imagenUrl} />
                    <span className="flex-1 min-w-0 leading-tight">
                      <span className="block font-bold text-ink-900 truncate">{i.nombre}</span>
                      <span className="block text-xs text-ink-500 truncate">{[i.codigo, i.disciplina || "General", i.ubicacion].filter(Boolean).join(" · ")}</span>
                    </span>
                    {i.bajoStock && <Insignia tono="dorado">Bajo stock</Insignia>}
                    {!i.activo && <Insignia tono="gris">Inactivo</Insignia>}
                  </span>
                  <BarraExistencias i={i} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Tarjeta titulo="Préstamos activos" subtitulo="Los vencidos aparecen primero y en rojo">
          {datos?.prestamos.length === 0 && <Vacio>No hay implementos prestados.</Vacio>}
          <ul className="list-none m-0 p-0">
            {[...(datos?.prestamos || [])]
              .sort((a, b) => Number(b.vencido) - Number(a.vencido))
              .map((p) => (
                <FilaPrestamo
                  key={p.id}
                  p={p}
                  mostrarImplemento
                  onDevuelto={() => {
                    setAviso(`Devolución registrada: ${p.implemento}.`);
                    cargar();
                  }}
                />
              ))}
          </ul>
        </Tarjeta>
      )}
    </main>
  );
}
