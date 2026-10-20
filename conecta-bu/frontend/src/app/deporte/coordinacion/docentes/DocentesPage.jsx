import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Aviso, Campo, Encabezado, Insignia, Vacio, botonPrimario, botonSecundario, claseCampo } from "../../comunes/componentes/ui";
import { useConfirmar } from "../../comunes/componentes/Confirmar";
import { Icono } from "../../comunes/componentes/Iconos";
import { BotonFlotante, Ventana } from "../../comunes/componentes/Ventana";
import { http } from "../../../../lib/api/http";
import { horas } from "../../comunes/lib/deporte";
import { mensajeError } from "../../comunes/lib/salud";
import { Pastillas } from "../../comunes/Pastillas";
import { CONTENEDOR } from "../../comunes/estilos";

// Docentes (RF-004, RF-007): registro, carga por CSV y grupos asignados.

// ---- Docentes (RF-004, RF-007) --------------------------------------------------------
function leerArchivo(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result || ""));
    lector.onerror = reject;
    lector.readAsText(archivo, "utf-8");
  });
}

const DOCENTE_VACIO = { email: "", nombre: "", telefono: "", especialidad: "" };

export function DocentesPage() {
  const [docentes, setDocentes] = useState(null);
  const [filtro, setFiltro] = useState("activos");
  const [q, setQ] = useState("");
  const [nuevo, setNuevo] = useState(null);
  const [editando, setEditando] = useState(null);
  const [resultadoCsv, setResultadoCsv] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const archivoRef = useRef(null);

  const cargar = useCallback(() => http.get("/deporte/admin/docentes").then((r) => setDocentes(r.data.docentes)), []);
  useEffect(() => {
    cargar().catch((err) => setError(mensajeError(err, "No fue posible cargar los docentes.")));
  }, [cargar]);

  const { confirmar, avisar } = useConfirmar();
  // Pregunta antes de actuar y avisa cuando termina.
  async function accion(pregunta, hacer, mensaje) {
    if (pregunta && !(await confirmar(pregunta))) return false;
    setError("");
    setAviso("");
    try {
      await hacer();
      await cargar();
      setAviso(mensaje);
      avisar(mensaje);
      return true;
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar."));
      return false;
    }
  }

  async function subirCsv(e) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setError("");
    setAviso("");
    try {
      const contenido = await leerArchivo(archivo);
      const filas = contenido.split(/\r?\n/).filter((l) => l.trim()).length;
      if (!(await confirmar({ titulo: "¿Cargar docentes desde el archivo?", mensaje: "Los correos nuevos quedan registrados y con acceso a su panel; los que ya existen se actualizan.", detalle: [["Archivo", archivo.name], ["Filas", filas]], boton: "Sí, cargar" }))) return;
      const r = await http.post("/deporte/admin/docentes/csv", { contenido });
      setResultadoCsv({ ...r.data, archivo: archivo.name });
      avisar(`Carga terminada: ${r.data.creados} nuevos y ${r.data.actualizados} actualizados.`);
      await cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible leer el archivo."));
    }
  }

  const conteos = useMemo(() => {
    const l = docentes || [];
    return { activos: l.filter((d) => d.activo).length, sinGrupos: l.filter((d) => d.activo && d.grupos.length === 0).length, externos: l.filter((d) => d.externo).length, inactivos: l.filter((d) => !d.activo).length };
  }, [docentes]);
  const visibles = (docentes || [])
    .filter((d) => (filtro === "activos" ? d.activo : filtro === "inactivos" ? !d.activo : filtro === "externos" ? d.externo : d.activo && d.grupos.length === 0))
    .filter((d) => !q || `${d.nombre} ${d.email} ${d.especialidad || ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <main className={CONTENEDOR}>
      <Encabezado
        kicker="Deporte"
        titulo="Docentes"
        descripcion="Registra a los entrenadores con su correo (institucional o externo). Al asignarles un grupo, entran a su panel y toman la asistencia solo de sus grupos."
        acciones={
          <>
            <input ref={archivoRef} type="file" accept=".csv,text/csv,text/plain" onChange={subirCsv} className="hidden" />
            <button type="button" onClick={() => archivoRef.current?.click()} className={botonSecundario}>
              <Icono nombre="subir" size={16} /> Cargar CSV
            </button>
          </>
        }
      />
      <div className="flex flex-col gap-4 mb-5">
        {error && <Aviso>{error}</Aviso>}
        {aviso && <Aviso tono="verde">{aviso}</Aviso>}
        {resultadoCsv && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-col gap-2" role="status">
            <div className="flex justify-between gap-3 flex-wrap">
              <p className="m-0 font-bold text-ink-900">
                {resultadoCsv.archivo}: {resultadoCsv.creados} nuevo{resultadoCsv.creados === 1 ? "" : "s"}, {resultadoCsv.actualizados} actualizado{resultadoCsv.actualizados === 1 ? "" : "s"}
                {resultadoCsv.errores.length ? `, ${resultadoCsv.errores.length} con error` : ""}
              </p>
              <button type="button" onClick={() => setResultadoCsv(null)} className="text-sm font-bold text-ink-500">
                Cerrar
              </button>
            </div>
            {resultadoCsv.errores.length > 0 && (
              <ul className="m-0 pl-5 text-sm text-red-700">
                {resultadoCsv.errores.map((e) => (
                  <li key={e.linea}>
                    Fila {e.linea}: {e.mensaje}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <p className="m-0 text-sm text-ink-500">
          El CSV lleva las columnas <strong>correo, nombre, teléfono, especialidad</strong> (con coma o punto y coma). Si el correo ya existe, se actualizan sus datos.
        </p>
      </div>

      {!nuevo && <BotonFlotante onClick={() => setNuevo(DOCENTE_VACIO)}>Nuevo docente</BotonFlotante>}
      {nuevo && (
        <Ventana titulo="Nuevo docente" alCerrar={() => setNuevo(null)} ancho="sm:max-w-[760px]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                accion(
                  { titulo: "¿Registrar a este docente?", mensaje: "Podrá entrar con su cuenta de Google a su panel de docente.", detalle: [["Nombre", nuevo.nombre], ["Correo", nuevo.email], ["Especialidad", nuevo.especialidad]], boton: "Sí, registrar" },
                  () => http.post("/deporte/admin/docentes", nuevo),
                  `${nuevo.nombre} quedó registrado. Ya puede entrar con su cuenta de Google.`
                ).then((ok) => ok && setNuevo(null));
              }}
              className="grid gap-3 sm:grid-cols-2"
            >
              <Campo etiqueta="Correo (cuenta de Google)" ayuda="Puede ser institucional o externo, por ejemplo Gmail.">
                <input type="email" required value={nuevo.email} onChange={(e) => setNuevo((n) => ({ ...n, email: e.target.value }))} placeholder="entrenador@uniautonoma.edu.co" className={claseCampo} />
              </Campo>
              <Campo etiqueta="Nombre completo">
                <input required maxLength={150} value={nuevo.nombre} onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))} className={claseCampo} />
              </Campo>
              <Campo etiqueta="Teléfono (opcional)">
                <input maxLength={30} value={nuevo.telefono} onChange={(e) => setNuevo((n) => ({ ...n, telefono: e.target.value }))} className={claseCampo} />
              </Campo>
              <Campo etiqueta="Especialidad (opcional)">
                <input maxLength={120} value={nuevo.especialidad} onChange={(e) => setNuevo((n) => ({ ...n, especialidad: e.target.value }))} placeholder="Natación, fútbol…" className={claseCampo} />
              </Campo>
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" className={botonPrimario}>
                  Registrar docente
                </button>
                <button type="button" onClick={() => setNuevo(null)} className={botonSecundario}>
                  Cancelar
                </button>
              </div>
            </form>
        </Ventana>
      )}

      <div className="flex flex-wrap gap-3 items-center mb-4">
        <Pastillas
          etiqueta="Filtrar docentes"
          opciones={[["activos", "Activos"], ["sinGrupos", "Sin grupos"], ["externos", "Externos"], ["inactivos", "Inactivos"]]}
          valor={filtro}
          onCambio={setFiltro}
          conteos={conteos}
        />
        <label className="relative flex-[1_1_220px] max-w-sm">
          <span className="sr-only">Buscar docente</span>
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">
            <Icono nombre="buscar" size={18} />
          </span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, correo o especialidad" className={`${claseCampo} pl-10`} />
        </label>
      </div>

      {!docentes && <p className="text-ink-500">Cargando…</p>}
      {docentes && visibles.length === 0 && <Vacio>{docentes.length === 0 ? "Aún no hay docentes. Registra el primero o carga un CSV." : "Ningún docente con este filtro."}</Vacio>}
      <ul className="list-none m-0 p-0 grid grid-cols-1 gap-3 md:grid-cols-2">
        {visibles.map((d) => (
          <li key={d.id} className={`bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 ${d.activo ? "" : "opacity-70"}`}>
            {editando?.id === d.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  accion(
                    { titulo: `¿Guardar los cambios de ${d.nombre}?`, detalle: [["Nombre", editando.nombre], ["Teléfono", editando.telefono], ["Especialidad", editando.especialidad]], boton: "Sí, guardar" },
                    () => http.patch(`/deporte/admin/docentes/${d.id}`, { nombre: editando.nombre, telefono: editando.telefono, especialidad: editando.especialidad }),
                    "Datos del docente actualizados."
                  ).then((ok) => ok && setEditando(null));
                }}
                className="grid gap-2"
              >
                <input required aria-label="Nombre" value={editando.nombre} onChange={(e) => setEditando((x) => ({ ...x, nombre: e.target.value }))} className={claseCampo} />
                <div className="grid gap-2 grid-cols-2">
                  <input aria-label="Teléfono" placeholder="Teléfono" value={editando.telefono || ""} onChange={(e) => setEditando((x) => ({ ...x, telefono: e.target.value }))} className={claseCampo} />
                  <input aria-label="Especialidad" placeholder="Especialidad" value={editando.especialidad || ""} onChange={(e) => setEditando((x) => ({ ...x, especialidad: e.target.value }))} className={claseCampo} />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className={`${botonPrimario} min-h-[38px]`}>
                    Guardar
                  </button>
                  <button type="button" onClick={() => setEditando(null)} className={`${botonSecundario} min-h-[38px]`}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-11 h-11 rounded-full bg-[#FFEDD5] text-[#C2410C] font-extrabold grid place-items-center">
                  {d.nombre
                    .split(" ")
                    .slice(0, 2)
                    .map((x) => x[0])
                    .join("")}
                </span>
                <div className="flex-1 min-w-0 leading-tight">
                  <p className="m-0 font-bold text-ink-900 truncate">{d.nombre}</p>
                  <p className="m-0 text-xs text-ink-500 truncate">
                    {d.email}
                    {d.telefono ? ` · ${d.telefono}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {d.especialidad && <Insignia tono="azul">{d.especialidad}</Insignia>}
                    {d.externo && <Insignia tono="dorado">Externo</Insignia>}
                    {!d.activo && <Insignia tono="gris">Inactivo</Insignia>}
                    {d.activo && !d.haIngresado && <Insignia tono="gris">Aún no ha ingresado</Insignia>}
                  </div>
                </div>
                <button type="button" onClick={() => setEditando({ id: d.id, nombre: d.nombre, telefono: d.telefono, especialidad: d.especialidad })} aria-label={`Editar ${d.nombre}`} className="w-9 h-9 rounded-full text-ink-500 hover:bg-gray-100 grid place-items-center">
                  <Icono nombre="editar" size={16} />
                </button>
              </div>
            )}
            <div className="border-t border-gray-100 pt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-ink-600">
                {d.grupos.length ? (
                  <>
                    <strong>{d.grupos.length}</strong> grupo{d.grupos.length === 1 ? "" : "s"} · {horas(d.horasSemana)} por semana
                  </>
                ) : (
                  "Sin grupos asignados este periodo"
                )}
              </span>
              <button
                type="button"
                onClick={() =>
                  accion(
                    d.activo
                      ? { titulo: `¿Desactivar a ${d.nombre}?`, mensaje: `Ya no podrá entrar a su panel ni tomar asistencia${d.grupos.length ? ` de sus ${d.grupos.length} grupo(s)` : ""}. Puedes activarlo de nuevo cuando quieras.`, boton: "Sí, desactivar", peligro: true }
                      : { titulo: `¿Activar a ${d.nombre}?`, mensaje: "Podrá entrar de nuevo a su panel de docente.", boton: "Sí, activar" },
                    () => http.patch(`/deporte/admin/docentes/${d.id}`, { activo: !d.activo }),
                    d.activo ? `${d.nombre} quedó inactivo y ya no puede entrar.` : `${d.nombre} está activo de nuevo.`
                  )
                }
                className={`${botonSecundario} min-h-[36px] text-[13px]`}
              >
                {d.activo ? "Desactivar" : "Activar"}
              </button>
            </div>
            {d.grupos.length > 0 && (
              <ul className="list-none m-0 p-0 flex flex-wrap gap-1.5">
                {d.grupos.map((g) => (
                  <li key={g.id}>
                    <Link to={`/deporte/grupos/${g.id}`} title={g.horarioTexto} className="inline-flex items-center min-h-[32px] px-3 rounded-full bg-gray-50 border border-gray-200 text-[13px] font-semibold text-ink-700 hover:border-primary/50">
                      {g.nombre}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
