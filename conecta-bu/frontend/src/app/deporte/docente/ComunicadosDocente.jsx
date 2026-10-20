import { useCallback, useEffect, useState } from "react";
import { Aviso, Vacio } from "../comunes/componentes/ui";
import { BotonFlotante, Ventana } from "../comunes/componentes/Ventana";
import { http } from "../../../lib/api/http";
import { FormularioComunicado, TarjetaComunicado } from "../comunes/Comunicados";
import { CONTENEDOR } from "../comunes/estilos";
import { useInicioDocente } from "./InicioDocente";
import { API } from "./constantes";

// Comunicados del docente a sus grupos.

export function ComunicadosDocente() {
  const { datos } = useInicioDocente();
  const [alertas, setAlertas] = useState(null);
  const [aviso, setAviso] = useState("");
  const [creando, setCreando] = useState(false);
  const cargar = useCallback(() => http.get(`${API}/alertas`).then((r) => setAlertas(r.data.alertas)), []);
  useEffect(() => {
    cargar();
  }, [cargar]);
  return (
    <main className={`${CONTENEDOR} flex flex-col gap-6`}>
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <h1 className="m-0 text-3xl font-extrabold">Comunicados a mis grupos</h1>
          <p className="mt-1.5 mb-0 text-ink-500">Avisa a tus estudiantes de cambios de lugar, horario o lo que necesiten saber.</p>
        </div>
      </div>
      {datos?.grupos.length > 0 && !creando && (
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
      {datos && datos.grupos.length === 0 && <Vacio>Necesitas tener grupos asignados para enviar comunicados.</Vacio>}
      {creando && datos?.grupos.length > 0 && (
        <Ventana titulo="Nuevo comunicado" alCerrar={() => setCreando(false)}>
          <FormularioComunicado
            api={API}
            soloGrupo
            grupos={datos.grupos}
            onCancelar={() => setCreando(false)}
            onEnviado={(a) => {
              setCreando(false);
              setAviso(`Comunicado enviado a ${a.destino}: le llega a ${a.alcanzados} estudiante${a.alcanzados === 1 ? "" : "s"}.`);
              cargar();
            }}
          />
        </Ventana>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="m-0 font-sans text-lg font-bold text-primary-dark">Enviados a tus grupos</h2>
        {alertas?.length === 0 && <Vacio>Aún no hay comunicados.</Vacio>}
        {alertas?.map((a) => (
          <TarjetaComunicado key={a.id} a={a} />
        ))}
      </section>
    </main>
  );
}
