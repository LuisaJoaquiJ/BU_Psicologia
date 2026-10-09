# n8n en Conecta BU (Sprint 5 · RF-013 y RF-014)

Esta carpeta trae los dos flujos de n8n listos para importar:

| Archivo | Flujo | Webhook | Qué hace |
|---|---|---|---|
| `notificaciones.workflow.json` | Conecta BU - Notificaciones (RF-013) | `POST /webhook/conecta-bu` | Envía un correo al estudiante cuando agenda o cancela una cita, o cuando se inscribe o cancela su inscripción a un evento. |
| `asistente.workflow.json` | Conecta BU - Asistente de orientación (RF-014) | `POST /webhook/asistente` | Recibe la pregunta del estudiante con el contexto real de Conecta BU, consulta a Gemini y devuelve `{ "respuesta": "..." }`. |

El backend ya está preparado para llamarlos (`backend/src/integrations/n8n.client.js`). Si n8n no está
encendido, la plataforma sigue funcionando: las citas e inscripciones se guardan igual y el asistente
responde con su base de conocimiento local.

```
Backend Conecta BU ──POST──▶ n8n /webhook/conecta-bu ──▶ Preparar correo ──▶ Enviar correo (SMTP)
Backend Conecta BU ──POST──▶ n8n /webhook/asistente ──▶ Armar consulta ──▶ Gemini ──▶ Responder al backend
```

## 1. Claves

Crea un archivo `.env` en la carpeta raíz del proyecto (junto a `docker-compose.yml`). No lo subas a GitHub:
ya está en `.gitignore`.

```
CONECTA_BU_SECRET=una-clave-larga-que-inventes
GEMINI_API_KEY=tu-clave-de-google-ai-studio
GEMINI_MODEL=gemini-flash-latest
CONECTA_BU_REMITENTE=tu-correo@gmail.com
```

- `GEMINI_API_KEY`: se crea gratis en [Google AI Studio](https://aistudio.google.com/apikey).
- `GEMINI_MODEL`: `gemini-flash-latest` usa siempre el modelo Flash vigente. Si Google lo cambia, pon el nombre de otro modelo de la [lista oficial](https://ai.google.dev/gemini-api/docs/models).
- `CONECTA_BU_SECRET`: la misma clave va en `backend/.env` como `N8N_SECRET`. n8n rechaza las peticiones que no la traigan.

## 2. Encender n8n

```powershell
docker compose up -d n8n
```

Abre <http://localhost:5678> y crea la cuenta de administrador de n8n (solo la primera vez).

## 3. Importar los flujos

Opción A, desde la terminal:

```powershell
docker compose exec n8n n8n import:workflow --input=/home/node/flujos/notificaciones.workflow.json
docker compose exec n8n n8n import:workflow --input=/home/node/flujos/asistente.workflow.json
```

Opción B, desde la página: **Workflows › ⋯ › Import from file** y elige cada archivo de esta carpeta.

## 4. Configurar el correo (solo el flujo de notificaciones)

1. En n8n abre **Conecta BU - Notificaciones** y haz doble clic en el nodo **Enviar correo**.
2. En *Credential* elige **Create new credential › SMTP** con:
   - Gmail: host `smtp.gmail.com`, puerto `465`, SSL/TLS activado, usuario = tu correo, contraseña = una
     [contraseña de aplicación](https://myaccount.google.com/apppasswords) (no tu contraseña normal).
   - Correo institucional: pide a TI los datos SMTP de la Uniautónoma.
3. Guarda.

## 5. Activar los flujos

En cada flujo pulsa **Publish** (o el interruptor **Active**, según tu versión de n8n). Desde ese momento
los webhooks de producción quedan escuchando.

## 6. Conectar el backend

En `backend/.env` agrega y reinicia el backend:

```
N8N_WEBHOOK_URL=http://localhost:5678/webhook/conecta-bu
N8N_AGENTE_URL=http://localhost:5678/webhook/asistente
N8N_SECRET=una-clave-larga-que-inventes
```

## 7. Probar

- Agenda una cita como estudiante: te debe llegar el correo de confirmación. En **Estadísticas ›
  Automatizaciones** (panel de administrador) el envío aparece como **Exitosa**.
- Abre el **Asistente** y pregunta "¿Qué eventos hay?": la respuesta ahora la redacta Gemini con los
  eventos reales.
- Pregunta "¿qué medicamento tomo para la ansiedad?": el backend la frena antes de llegar a n8n (RN-011).

En n8n, **Executions** muestra cada ejecución paso a paso si algo falla.
