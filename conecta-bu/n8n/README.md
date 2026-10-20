# n8n en Conecta BU (Sprint 5 · RF-013 y RF-014)

Esta carpeta trae los dos flujos de n8n listos para importar:

| Archivo | Flujo | Webhook | Qué hace |
|---|---|---|---|
| `notificaciones.workflow.json` | Conecta BU - Notificaciones (RF-013) | `POST /webhook/conecta-bu` | Envía un correo al estudiante cuando agenda o cancela una cita, o cuando se inscribe o cancela su inscripción a un evento. |
| `asistente.workflow.json` | Conecta BU - Asistente de orientación (RF-014) | `POST /webhook/asistente` | Recibe la pregunta del estudiante, los últimos mensajes de la conversación y el contexto autorizado de Conecta BU; consulta a Gemini y devuelve `{ "respuesta": "..." }`. |

El backend ya está preparado para llamarlos (`backend/src/integrations/n8n.client.js`). Si n8n no está
encendido, la plataforma sigue funcionando: las citas e inscripciones se guardan igual y el asistente
responde con su base de conocimiento local.

Probado con **n8n 2.42.7** (la versión queda fija en `docker-compose.yml`).

### Qué sabe el agente

El agente **no consulta la base de datos** (F-02, arquitectura): el backend le envía en cada pregunta solo
lo autorizado:

- los servicios de Orientación con sus horarios libres más próximos (sin los que caen en un tiempo «no disponible»);
- los próximos talleres y eventos (fecha, lugar o si es virtual, cupos y si el estudiante ya está inscrito; nunca el enlace de la reunión);
- las citas agendadas **del propio estudiante** y si todavía se pueden cancelar;
- los últimos mensajes de la conversación, para entender preguntas como «¿y a qué hora?».

Nunca viajan notas del personal, datos de otros estudiantes ni información clínica. Las preguntas de crisis o
clínicas las responde el backend sin IA (RN-011) y tampoco se envían después como parte del historial.

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
SMTP_USUARIO=tu-correo@gmail.com
SMTP_CLAVE=tu-contraseña-de-aplicacion
```

- `GEMINI_API_KEY`: se crea gratis en [Google AI Studio](https://aistudio.google.com/apikey).
- `GEMINI_MODEL`: `gemini-flash-latest` usa siempre el modelo Flash vigente. Si Google lo cambia, pon el nombre de otro modelo de la [lista oficial](https://ai.google.dev/gemini-api/docs/models).
- `CONECTA_BU_SECRET`: la misma clave va en `backend/.env` como `N8N_SECRET`. n8n rechaza las peticiones que no la traigan.
- `SMTP_USUARIO` y `SMTP_CLAVE` (opcionales): el correo desde el que salen las notificaciones. Con Gmail usa una
  [contraseña de aplicación](https://myaccount.google.com/apppasswords), no tu contraseña normal (hay que tener
  la verificación en dos pasos activa). Para otro servidor agrega `SMTP_HOST` y `SMTP_PUERTO`. Si los dejas vacíos,
  todo funciona menos el envío de correos.

## 2. Encender n8n

Necesitas Docker Desktop abierto (con «Engine running»). En la carpeta raíz:

```powershell
docker compose up -d n8n
```

Eso es todo: al encender, `n8n/iniciar.sh` **importa y publica los dos flujos** y crea la credencial de correo con
los datos del `.env`. Espera unos 30 segundos y revisa con `docker compose logs n8n` que diga
`[Conecta BU] Flujos importados y publicados.`

- Si cambias algo del `.env`, aplica los cambios con `docker compose up -d n8n` (vuelve a crear el contenedor).
- Puedes ver los flujos y sus ejecuciones en <http://localhost:5678> (la primera vez pide crear una cuenta de
  administrador de n8n; no hace falta para que funcionen).
- Los cambios que hagas a estos dos flujos desde la página se reemplazan al reiniciar n8n. Para cambiarlos de
  forma permanente edita los `.json` de esta carpeta.


## 3. Conectar el backend

En `backend/.env` agrega y reinicia el backend:

```
N8N_WEBHOOK_URL=http://localhost:5678/webhook/conecta-bu
N8N_AGENTE_URL=http://localhost:5678/webhook/asistente
N8N_SECRET=una-clave-larga-que-inventes
```

## 4. Probar

Primero corre la prueba automática (revisa las claves, que n8n esté encendido, que el agente responda y,
si le das un correo, envía uno de prueba):

```powershell
powershell -ExecutionPolicy Bypass -File .\n8n\probar-n8n.ps1 -Correo tu-correo@gmail.com
```

Después, en la aplicación:

- Agenda una cita como estudiante: te debe llegar el correo de confirmación. En **Estadísticas ›
  Automatizaciones** (panel de administrador) el envío aparece como **Exitosa**.
- Abre el **Asistente** y pregunta "¿Qué eventos hay?": la respuesta ahora la redacta Gemini con los
  eventos reales.
- Pregunta "¿qué medicamento tomo para la ansiedad?": el backend la frena antes de llegar a n8n (RN-011).

En n8n, **Executions** muestra cada ejecución paso a paso si algo falla.

## Problemas frecuentes

| Lo que ves | Qué pasa | Cómo se arregla |
|---|---|---|
| `404` al llamar al webhook | El flujo no quedó publicado | Mira `docker compose logs n8n`: debe decir «Flujos importados y publicados». Si no, `docker compose restart n8n`. |
| `500` y en Executions «secreto invalido» | `CONECTA_BU_SECRET` (raíz) y `N8N_SECRET` (backend) no son iguales | Pon la misma clave en los dos `.env`, luego `docker compose up -d n8n` y reinicia el backend. |
| Docker: «Virtual Machine Platform not enabled» | Windows no tiene activada la virtualización | PowerShell como administrador: `Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform` y `...-FeatureName Microsoft-Windows-Subsystem-Linux`, reinicia Windows y luego `wsl --update`. |
| `500` y Gemini responde `400`/`403` | La clave de Gemini no es válida | Revisa `GEMINI_API_KEY` en el `.env` de la raíz y vuelve a encender n8n. |
| Gemini responde `429` | Se acabó la cuota gratuita del momento | Espera un minuto; el asistente responde mientras tanto con su base local. |
| Gemini responde `404` (modelo) | El nombre del modelo cambió | Cambia `GEMINI_MODEL` (por ejemplo `gemini-flash-latest`). |
| No llega el correo | Faltan o están mal `SMTP_USUARIO`/`SMTP_CLAVE` | Revisa el paso 1 (con Gmail, contraseña de aplicación) y aplica con `docker compose up -d n8n`. Mira también spam. |
| El asistente responde, pero no con Gemini | El backend no encuentra n8n | Revisa `N8N_AGENTE_URL` en `backend/.env`. En **Estadísticas › Automatizaciones** aparece `asistente.consulta` como fallida con el motivo. |

Después de cambiar el `.env` de la raíz hay que volver a crear el contenedor: `docker compose up -d n8n`.
