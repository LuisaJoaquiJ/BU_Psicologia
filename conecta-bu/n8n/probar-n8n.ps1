# Prueba rapida de n8n para Conecta BU (RF-013 y RF-014).
# Uso (terminal de VS Code, dentro de la carpeta conecta-bu):
#   powershell -ExecutionPolicy Bypass -File .\n8n\probar-n8n.ps1
#   powershell -ExecutionPolicy Bypass -File .\n8n\probar-n8n.ps1 -Correo tu-correo@gmail.com
# Revisa que n8n este encendido, que el agente responda con Gemini y, si
# indicas un correo, envia un correo de prueba de "cita agendada".
param(
  [string]$Correo = "",
  [string]$N8n = "http://localhost:5678"
)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$raiz = Split-Path $PSScriptRoot -Parent

function Leer-Clave($archivo, $nombre) {
  if (-not (Test-Path $archivo)) { return "" }
  $linea = Get-Content $archivo | Where-Object { $_ -match "^\s*$nombre\s*=" } | Select-Object -First 1
  if (-not $linea) { return "" }
  return ($linea -split "=", 2)[1].Trim().Trim('"')
}

function Ok($texto) { Write-Host "  [OK] $texto" -ForegroundColor Green }
function Falla($texto, $ayuda) { Write-Host "  [X] $texto" -ForegroundColor Red; if ($ayuda) { Write-Host "      $ayuda" -ForegroundColor Yellow } }

$secreto = Leer-Clave (Join-Path $raiz ".env") "CONECTA_BU_SECRET"
$secretoBackend = Leer-Clave (Join-Path $raiz "backend\.env") "N8N_SECRET"
$gemini = Leer-Clave (Join-Path $raiz ".env") "GEMINI_API_KEY"

Write-Host "`n1. Claves" -ForegroundColor Cyan
if ($secreto) { Ok "CONECTA_BU_SECRET esta en .env (carpeta raiz)" } else { Falla "Falta CONECTA_BU_SECRET en .env (carpeta raiz)" "Crea el archivo .env junto a docker-compose.yml (ver n8n/README.md, paso 1)." }
if ($secreto -and $secretoBackend -ne $secreto) { Falla "N8N_SECRET de backend\.env no es igual a CONECTA_BU_SECRET" "Deben ser exactamente la misma clave." } elseif ($secreto) { Ok "N8N_SECRET del backend coincide" }
if ($gemini) { Ok "GEMINI_API_KEY esta en .env" } else { Falla "Falta GEMINI_API_KEY en .env" "Creala gratis en https://aistudio.google.com/apikey" }

Write-Host "`n2. n8n encendido" -ForegroundColor Cyan
try {
  Invoke-RestMethod "$N8n/healthz" -TimeoutSec 5 | Out-Null
  Ok "n8n responde en $N8n"
} catch {
  Falla "n8n no responde en $N8n" "Enciendelo con: docker compose up -d n8n  (y espera unos 20 segundos)"
  exit 1
}

$cabeceras = @{ "X-Conecta-BU-Secret" = $secreto }

Write-Host "`n3. Agente de orientacion (Gemini)" -ForegroundColor Cyan
$consulta = @{
  pregunta  = "Hola, que servicios ofrece Orientacion?"
  historial = @()
  usuario   = @{ nombre = "Prueba" }
  contexto  = @{
    hoy       = (Get-Date).ToString("dddd, d 'de' MMMM", [Globalization.CultureInfo]"es-CO")
    servicios = @(@{ nombre = "Orientacion psicologica individual"; descripcion = "Acompanamiento personalizado."; horariosLibres = 2; proximosHorarios = @("martes 9:00 a. m.") })
    eventos   = @()
    misCitas  = @()
  }
  reglas    = "Responde en espanol, breve y amable."
} | ConvertTo-Json -Depth 6
try {
  $r = Invoke-RestMethod "$N8n/webhook/asistente" -Method Post -Headers $cabeceras -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($consulta)) -TimeoutSec 30
  Ok "El agente respondio:"
  Write-Host "      $($r.respuesta)"
} catch {
  $codigo = $_.Exception.Response.StatusCode.value__
  if ($codigo -eq 404) { Falla "El flujo del asistente no esta activo (404)" "Mira 'docker compose logs n8n': debe decir 'Flujos importados y publicados'. Si no, 'docker compose restart n8n'." }
  elseif ($codigo -eq 500) { Falla "El flujo fallo (500)" "En n8n > Executions mira el error. Suele ser: secreto distinto, GEMINI_API_KEY invalida o cuota de Gemini agotada (429)." }
  else { Falla "No se pudo consultar al agente: $($_.Exception.Message)" "" }
}

Write-Host "`n4. Correo de notificacion" -ForegroundColor Cyan
if (-not $Correo) {
  Write-Host "  (omitido) Para probarlo: .\n8n\probar-n8n.ps1 -Correo tu-correo@gmail.com"
} else {
  $aviso = @{
    tipo   = "cita.agendada"
    origen = "prueba"
    fecha  = (Get-Date).ToString("o")
    datos  = @{
      estudiante = @{ nombre = "Prueba Conecta BU"; email = $Correo }
      cita       = @{ servicio = "Orientacion psicologica individual"; fecha = (Get-Date).AddDays(1).ToString("yyyy-MM-dd") + "T00:00:00.000Z"; horaInicio = "1970-01-01T09:00:00.000Z" }
    }
  } | ConvertTo-Json -Depth 6
  try {
    Invoke-RestMethod "$N8n/webhook/conecta-bu" -Method Post -Headers $cabeceras -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($aviso)) -TimeoutSec 15 | Out-Null
    Ok "n8n recibio la notificacion. Revisa la bandeja (y la carpeta de spam) de $Correo"
    Write-Host "      Si no llega, en n8n > Executions revisa el nodo 'Enviar correo'. Faltan o estan mal SMTP_USUARIO / SMTP_CLAVE en .env (con Gmail, contrasena de aplicacion)."
  } catch {
    Falla "No se pudo enviar la notificacion: $($_.Exception.Message)" "Revisa 'docker compose logs n8n'."
  }
}
Write-Host ""
