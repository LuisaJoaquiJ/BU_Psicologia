import { useCallback, useEffect, useState } from "react";
import { Aviso, Encabezado, Vacio } from "../../comunes/componentes/ui";
import { useConfirmar } from "../../comunes/componentes/Confirmar";
import { BotonFlotante, Ventana } from "../../comunes/componentes/Ventana";
import { http } from "../../../../lib/api/http";
import { mensajeError } from "../../comunes/lib/salud";
import { FormularioComunicado, TarjetaComunicado } from "../../comunes/Comunicados";
import { CONTENEDOR } from "../../comunes/estilos";
import { useCatalogosDeporte } from "../../comunes/useCatalogosDeporte";

// Comunicados enviados por la coordinación.

export function ComunicadosPage() {
  const { cat } = useCatalogosDeporte();
  const { confirmar, avisar } = useConfirmar();
  const [alertas, setAlertas] = useState(null);
  const [grupos, setGrupos] = useState([]);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);
  const cargar = useCallback(() => http.get("/deporte/admin/alertas").then((r) => setAlertas(r.data.alertas)), []);
  useEffect(() => {
    cargar();
    http.get("/deporte/admin/grupos").then((r) => setGrupos(r.data.grupos));
  }, [cargar]);
  return (
    <main className={`${CONTENEDOR} flex flex-col gap-6`}>
      <Encabezado
        kicker="Deporte"
        titulo="Comunicados"
        descripcion="Avisos para todos los inscritos, para una disciplina o para un grupo. Les aparecen en su área de Deporte, ordenados por prioridad."
      />
      {!creando && (
        <BotonFlotante
          onClick={() => {
            setCreando(true);
            setAviso("");
          }}
        >
          Nuevo comunicado
        </BotonFlotante>
      )}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      {error && <Aviso>{error}</Aviso>}
      {creando && (
        <Ventana titulo="Nuevo comunicado" alCerrar={() => setCreando(false)}>
          <FormularioComunicado
            cat={cat}
            grupos={grupos}
            onCancelar={() => setCreando(false)}
            onEnviado={(a) => {
              setCreando(false);
              setAviso(`Comunicado enviado: le llega a ${a.alcanzados} estudiante${a.alcanzados === 1 ? "" : "s"}.`);
              cargar();
            }}
          />
        </Ventana>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="m-0 font-sans text-lg font-bold text-primary-dark">Enviados</h2>
        {alertas?.length === 0 && <Vacio>Aún no hay comunicados.</Vacio>}
        {alertas?.map((a) => (
          <TarjetaComunicado
            key={a.id}
            a={a}
            onEliminar={async () => {
              if (!(await confirmar({ titulo: `¿Eliminar «${a.titulo}»?`, mensaje: "Los estudiantes dejarán de verlo. Esta acción no se puede deshacer.", boton: "Sí, eliminar", peligro: true }))) return;
              try {
                await http.delete(`/deporte/admin/alertas/${a.id}`);
                avisar("Comunicado eliminado.");
                cargar();
              } catch (err) {
                setError(mensajeError(err, "No fue posible eliminarlo."));
              }
            }}
          />
        ))}
      </section>
    </main>
  );
}
