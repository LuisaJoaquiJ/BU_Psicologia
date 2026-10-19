#!/bin/sh
# Arranque de n8n para Conecta BU (lo usa docker-compose.yml).
# Cada vez que se enciende el contenedor:
#   1. Si hay datos de correo en el .env (SMTP_USUARIO y SMTP_CLAVE), crea o
#      actualiza la credencial "Correo Conecta BU".
#   2. Importa los dos flujos de esta carpeta y los publica (quedan activos).
#   3. Enciende n8n.
# Asi no hace falta importar ni publicar nada a mano. Ojo: los cambios que se
# hagan a estos dos flujos desde la pagina de n8n se reemplazan al reiniciar;
# para cambiarlos de forma permanente, edita los .json de esta carpeta.
set -e
FLUJOS=${FLUJOS:-/home/node/flujos}

if [ -n "$SMTP_USUARIO" ] && [ -n "$SMTP_CLAVE" ]; then
  node -e '
    const e = process.env;
    const cred = [{
      id: "CbuSmtpCorreo01",
      name: "Correo Conecta BU",
      type: "smtp",
      data: {
        user: e.SMTP_USUARIO,
        password: e.SMTP_CLAVE,
        host: e.SMTP_HOST || "smtp.gmail.com",
        port: Number(e.SMTP_PUERTO || 465),
        secure: (e.SMTP_PUERTO || "465") === "465",
      },
    }];
    require("fs").writeFileSync("/tmp/credencial-correo.json", JSON.stringify(cred));
  '
  n8n import:credentials --input=/tmp/credencial-correo.json || echo "[Conecta BU] No se pudo crear la credencial de correo."
  rm -f /tmp/credencial-correo.json
  echo "[Conecta BU] Credencial de correo lista."
else
  echo "[Conecta BU] Sin SMTP_USUARIO/SMTP_CLAVE en el .env: los correos no se enviaran (el resto funciona)."
fi

for flujo in notificaciones asistente; do
  n8n import:workflow --input="$FLUJOS/$flujo.workflow.json" || echo "[Conecta BU] No se pudo importar $flujo."
done
n8n publish:workflow --id=CbuNotificacion1 || true
n8n publish:workflow --id=CbuAsistenteIA01 || true
echo "[Conecta BU] Flujos importados y publicados."

exec n8n start
