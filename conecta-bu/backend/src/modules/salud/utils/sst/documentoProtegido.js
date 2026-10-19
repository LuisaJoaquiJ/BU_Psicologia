const crypto = require("crypto");
const { config } = require("../../../../config/env");

// Las sugerencias de personas (SST) no muestran la cedula completa: se ve
// enmascarada y viaja una referencia cifrada que solo el servidor abre al
// guardar el reporte. Asi nadie con sesion puede recorrer cedulas ajenas.
const clave = () => crypto.createHash("sha256").update(`${config.jwtSecret}:sst-documento`).digest();

function enmascarar(documento) {
  const v = String(documento || "");
  return v.length > 4 ? `${"*".repeat(4)}${v.slice(-4)}` : "****";
}

function cifrar(documento) {
  const iv = crypto.randomBytes(12);
  const cifrador = crypto.createCipheriv("aes-256-gcm", clave(), iv);
  const datos = Buffer.concat([cifrador.update(String(documento), "utf8"), cifrador.final()]);
  return Buffer.concat([iv, cifrador.getAuthTag(), datos]).toString("base64url");
}

// Documento de una referencia, o null si no es valida.
function descifrar(ref) {
  try {
    const b = Buffer.from(String(ref || ""), "base64url");
    if (b.length < 29) return null;
    const descifrador = crypto.createDecipheriv("aes-256-gcm", clave(), b.subarray(0, 12));
    descifrador.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([descifrador.update(b.subarray(28)), descifrador.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// Si el campo trae la cedula enmascarada de una sugerencia, se cambia por la real.
function resolver(documento, ref) {
  const real = ref ? descifrar(ref) : null;
  return real && String(documento || "").trim() === enmascarar(real) ? real : documento;
}

module.exports = { enmascarar, cifrar, descifrar, resolver };
