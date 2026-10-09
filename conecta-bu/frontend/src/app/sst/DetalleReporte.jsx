import { useState } from "react";
import { http } from "../../lib/api/http";
import { Icono } from "../../components/Iconos";
import { ESTILO_GRUPO, TONO_ESTADO, diasPara, fechaLarga, hora12, tamano } from "../../lib/sst";
import { Aviso, Insignia, Tarjeta } from "../salud/ui";

const DOC_CORTO = { CC: "C.C.", CE: "C.E.", TI: "T.I." };

// Abre un documento protegido en otra pestaña (se pide con la sesion).
export async function abrirDocumento(adjunto) {
  const ventana = window.open("", "_blank");
  try {
    const res = await http.get(`/reportes-sst/adjuntos/${adjunto.id}/archivo`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    if (ventana) ventana.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    ventana?.close();
    alert("No fue posible abrir el documento.");
  }
}

function Dato({ etiqueta, children, ancho }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className={ancho ? "sm:col-span-2" : ""}>
      <dt className="text-xs font-bold uppercase tracking-[0.08em] text-ink-500">{etiqueta}</dt>
      <dd className="m-0 mt-1 text-[15px] text-ink-900 whitespace-pre-line">{children}</dd>
    </div>
  );
}

export function EncabezadoReporte({ reporte, catalogo }) {
  const estilo = ESTILO_GRUPO[reporte.grupo] || ESTILO_GRUPO.estudiantes;
  const dias = diasPara(reporte.fechaSalida);
  return (
    <div className="flex items-start gap-4 flex-wrap">
      <span className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${estilo.color}`}>
        <Icono nombre={estilo.icono} size={26} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-bold text-ink-500">{reporte.codigo}</span>
          <Insignia tono={TONO_ESTADO[reporte.estado]}>{catalogo?.estados?.[reporte.estado] || reporte.estado}</Insignia>
          {reporte.fueraDeTiempo && <Insignia tono="rojo">Reportada fuera de tiempo</Insignia>}
          {reporte.adjuntosFaltantes?.length > 0 && <Insignia tono="dorado">Faltan documentos</Insignia>}
          {reporte.gestion && reporte.gestionExterna && (
            <Insignia tono="verde">
              <Icono nombre="check" size={13} strokeWidth={3} /> {reporte.gestion}
            </Insignia>
          )}
        </div>
        <h1 className="m-0 mt-1.5 text-2xl sm:text-[30px] font-extrabold leading-tight">
          {reporte.tipo === "CondicionInsegura" ? reporte.lugarEvento : reporte.evento || reporte.motivo}
        </h1>
        <p className="m-0 mt-1 text-ink-500">
          {reporte.tipoNombre}
          {reporte.fechaSalida && dias !== null && dias >= 0 && reporte.estado !== "Cerrado" && (
            <> · {dias === 0 ? "sale hoy" : dias === 1 ? "sale mañana" : `sale en ${dias} días`}</>
          )}
        </p>
      </div>
    </div>
  );
}

export function DetalleReporte({ reporte, catalogo }) {
  const esRiesgo = reporte.tipo === "CondicionInsegura";
  const transportes = catalogo?.transportes || {};
  const adjuntos = catalogo?.adjuntos || {};

  return (
    <div className="flex flex-col gap-5">
      {reporte.observacionRevision && (
        <Aviso tono={reporte.estado === "RequiereAjustes" ? "dorado" : "azul"}>
          <strong>Observación de la Unidad de Salud:</strong> {reporte.observacionRevision}
        </Aviso>
      )}

      {esRiesgo ? (
        <Tarjeta titulo="El evento">
          <dl className="m-0 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Dato etiqueta="Lugar">{reporte.lugarEvento}</Dato>
            <Dato etiqueta="Fecha y hora">
              {fechaLarga(reporte.fechaEvento)} · {hora12(reporte.horaEvento)}
            </Dato>
            <Dato etiqueta="Persona que sufre el evento">{reporte.afectado}</Dato>
            <Dato etiqueta="Cargo">{reporte.cargo}</Dato>
            <Dato etiqueta="Clasificación">{catalogo?.clasificaciones?.[reporte.clasificacion] || reporte.clasificacion}</Dato>
            <Dato etiqueta="Potencial">
              <Insignia tono={{ Alto: "rojo", Medio: "dorado", Bajo: "verde" }[reporte.potencial]}>{reporte.potencial}</Insignia>
            </Dato>
            <Dato etiqueta="Descripción" ancho>
              {reporte.descripcion}
            </Dato>
            <Dato etiqueta="Medida de control propuesta" ancho>
              {reporte.medidaControl}
            </Dato>
          </dl>
        </Tarjeta>
      ) : (
        <>
          <Tarjeta titulo="La salida">
            <dl className="m-0 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Dato etiqueta="Motivo" ancho>
                {reporte.motivo}
              </Dato>
              <Dato etiqueta="Origen">{reporte.ciudadOrigen}</Dato>
              <Dato etiqueta="Destino">{[reporte.destino, reporte.pais].filter(Boolean).join(", ")}</Dato>
              <Dato etiqueta="Lugar de destino">{reporte.lugarDestino}</Dato>
              <Dato etiqueta="Salida">
                {fechaLarga(reporte.fechaSalida)} · {hora12(reporte.horaSalida)}
              </Dato>
              <Dato etiqueta="Regreso">
                {fechaLarga(reporte.fechaRegreso)} · {hora12(reporte.horaRegreso)}
              </Dato>
              <Dato etiqueta="Anticipación">
                {reporte.diasAnticipacion < 0
                  ? "Reportada después de la salida"
                  : `${reporte.diasAnticipacion} día(s) antes${reporte.anticipacionMinima ? ` · mínimo ${reporte.anticipacionMinima}` : ""}`}
              </Dato>
              <Dato etiqueta="Estudiantes">{reporte.numeroEstudiantes}</Dato>
            </dl>
          </Tarjeta>

          <div className="grid gap-5 lg:grid-cols-2">
            <Tarjeta titulo={reporte.grupo === "estudiantes" && reporte.tipo !== "SalidaEstudiantesInternacional" ? "Docentes a cargo" : "Personas que viajan"}>
              <ul className="list-none m-0 p-0 flex flex-col">
                <li className="flex justify-between gap-3 py-2.5">
                  <span className="font-semibold">{reporte.responsableNombre}</span>
                  <span className="text-ink-500 text-sm tabular-nums">
                    {DOC_CORTO[reporte.responsableTipoDoc] || reporte.responsableTipoDoc} {reporte.responsableDocumento}
                  </span>
                </li>
                {(reporte.acompanantes || []).map((p, i) => (
                  <li key={i} className="flex justify-between gap-3 py-2.5 border-t border-gray-100">
                    <span>{p.nombre}</span>
                    <span className="text-ink-500 text-sm tabular-nums">{p.documento}</span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
            <Tarjeta titulo="Transporte">
              <dl className="m-0 grid gap-4">
                <Dato etiqueta="Medio">{transportes[reporte.medioTransporte] || reporte.medioTransporte}</Dato>
                <Dato etiqueta="Medio y empresa">{reporte.transporteEmpresa}</Dato>
                <Dato etiqueta="Conductor">{reporte.conductor}</Dato>
                <Dato etiqueta="Placa">{reporte.placa}</Dato>
              </dl>
            </Tarjeta>
          </div>
        </>
      )}

      <Tarjeta titulo="Documentos" subtitulo={`${reporte.adjuntos.length} archivo(s)`}>
        {reporte.adjuntosFaltantes?.length > 0 && (
          <div className="mb-3">
            <Aviso tono="dorado">Falta: {reporte.adjuntosFaltantes.map((t) => adjuntos[t] || t).join(", ")}.</Aviso>
          </div>
        )}
        {reporte.adjuntos.length === 0 && <p className="m-0 text-sm text-ink-500">Sin documentos adjuntos.</p>}
        <ul className="list-none m-0 p-0 grid gap-2.5 sm:grid-cols-2">
          {reporte.adjuntos.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => abrirDocumento(a)}
                className="w-full text-left flex items-center gap-3 border border-gray-200 rounded-xl px-3.5 py-3 hover:bg-gray-50"
              >
                <span className="w-10 h-10 rounded-lg bg-primary-light text-primary-soft flex items-center justify-center shrink-0">
                  <Icono nombre={a.tipoMime === "application/pdf" ? "archivo" : "imagen"} size={20} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-sm font-semibold text-ink-900">{adjuntos[a.tipo] || a.tipo}</span>
                  <span className="block text-xs text-ink-500 truncate">
                    {a.nombreArchivo} · {tamano(a.tamanoBytes)}
                  </span>
                </span>
                <Icono nombre="derecha" size={18} />
              </button>
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  );
}

// Selector de archivos por tipo de documento (formulario y "agregar documentos").
export function SelectorDocumento({ tipo, etiqueta, requerido, multiple, archivos = [], onCambio }) {
  const [arrastrando, setArrastrando] = useState(false);
  const id = `doc-${tipo}`;
  function recibir(lista) {
    const validos = Array.from(lista || []).filter((f) => /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type));
    onCambio(multiple ? [...archivos, ...validos].slice(0, 5) : validos.slice(0, 1));
  }
  const listo = archivos.length > 0;
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setArrastrando(true);
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastrando(false);
        recibir(e.dataTransfer.files);
      }}
      className={`rounded-xl border-[1.5px] px-4 py-3 flex items-center gap-3 transition-colors ${
        arrastrando ? "border-primary-soft bg-primary-light" : listo ? "border-[#9ED9CB] bg-[#F1FAF7]" : "border-dashed border-gray-300 bg-white"
      }`}
    >
      <span
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          listo ? "bg-[#0d9488] text-white" : "bg-gray-100 text-ink-500"
        }`}
      >
        <Icono nombre={listo ? "check" : "subir"} size={18} strokeWidth={2.4} />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-sm font-semibold text-ink-900">
          {etiqueta} {requerido ? <span className="text-red-600">*</span> : <span className="text-ink-500 font-normal">(opcional)</span>}
        </span>
        <span className="block text-xs text-ink-500 truncate">
          {listo ? archivos.map((f) => f.name).join(", ") : "PDF o foto · arrastra aquí o elige el archivo"}
        </span>
      </span>
      {listo && (
        <button type="button" onClick={() => onCambio([])} className="text-xs font-bold text-ink-500 hover:text-red-600 px-2" aria-label={`Quitar ${etiqueta}`}>
          Quitar
        </button>
      )}
      <label htmlFor={id} className="cursor-pointer text-sm font-bold text-primary-soft border border-gray-200 bg-white rounded-full px-3.5 min-h-[38px] inline-flex items-center hover:bg-gray-50">
        {listo && !multiple ? "Cambiar" : "Elegir"}
      </label>
      <input
        id={id}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          recibir(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
