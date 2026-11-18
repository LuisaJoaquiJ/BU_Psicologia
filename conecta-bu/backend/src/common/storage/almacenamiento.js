const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { AppError } = require("../utils/AppError");

// Adaptador de archivos: en produccion (SUPABASE_URL + SERVICE_ROLE_KEY)
// sube a Supabase Storage; en local sigue guardando en disco (uploads/).

function valor(v) {
  return String(v || "").trim();
}

function crearAlmacenamiento(deps = {}) {
  const obtenerConfig = () => deps.config || require("../../config/env").config;

  function config() {
    return obtenerConfig();
  }

  function usaSupabase() {
    const c = config();
    return Boolean(valor(c.supabaseUrl) && valor(c.supabaseServiceRoleKey));
  }

  function nombreBucket(tipo) {
    const c = config();
    return tipo === "publico" ? c.supabaseBucketPublico || "publico" : c.supabaseBucketPrivado || "privado";
  }

  let clienteMemo;
  function cliente() {
    if (deps.cliente) return typeof deps.cliente === "function" ? deps.cliente() : deps.cliente;
    if (!clienteMemo) {
      const { createClient } = require("@supabase/supabase-js");
      const c = config();
      clienteMemo = createClient(c.supabaseUrl, c.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return clienteMemo;
  }

  function raizUploads() {
    return path.resolve(config().saludUploadsDir);
  }

  // Evita leer o borrar rutas fuera de uploads/.
  function rutaSegura(clave) {
    if (!clave || typeof clave !== "string" || clave.includes("..")) return null;
    const base = raizUploads();
    const absoluta = path.resolve(base, clave);
    if (!absoluta.startsWith(base + path.sep)) return null;
    return absoluta;
  }

  function claveDesdeRuta(ruta) {
    if (!ruta) return null;
    const relativa = path.relative(raizUploads(), path.resolve(ruta));
    if (!relativa || relativa.startsWith("..") || path.isAbsolute(relativa)) return null;
    return relativa.split(path.sep).join("/");
  }

  function nombreDe(archivo) {
    if (!archivo) return null;
    if (archivo.filename) return archivo.filename;
    if (archivo.storageKey) return path.posix.basename(archivo.storageKey);
    if (archivo.path) return path.basename(archivo.path);
    return null;
  }

  // Multer: memoria si hay Supabase (se sube el buffer despues), disco si no.
  function motorMulter({ carpeta, extensionDe }) {
    if (usaSupabase()) return multer.memoryStorage();
    return multer.diskStorage({
      destination: (req, file, cb) => {
        const rel = typeof carpeta === "function" ? carpeta(req, file) : carpeta;
        const dir = path.join(raizUploads(), rel);
        fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
      },
      filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${extensionDe(file)}`),
    });
  }

  async function guardar(archivo, { carpeta, bucket, extension } = {}) {
    if (!archivo) throw new AppError(400, "Adjunta un archivo.");
    if (archivo.path && !usaSupabase()) {
      const clave = claveDesdeRuta(archivo.path);
      if (!clave) throw new AppError(500, "No fue posible guardar el archivo.");
      archivo.storageKey = clave;
      if (!archivo.filename) archivo.filename = path.basename(clave);
      return clave;
    }

    const rel = typeof carpeta === "function" ? carpeta : carpeta;
    if (!rel) throw new AppError(500, "No fue posible guardar el archivo.");
    const nombre = archivo.filename || `${crypto.randomUUID()}${extension || ""}`;
    const clave = `${String(rel).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")}/${nombre}`;
    archivo.filename = nombre;
    archivo.storageKey = clave;

    if (usaSupabase()) {
      if (!archivo.buffer) throw new AppError(500, "No fue posible guardar el archivo.");
      const { error } = await cliente().storage.from(nombreBucket(bucket)).upload(clave, archivo.buffer, {
        contentType: archivo.mimetype || "application/octet-stream",
        upsert: false,
      });
      if (error) throw new AppError(500, "No fue posible guardar el archivo.");
      return clave;
    }

    const destino = rutaSegura(clave);
    if (!destino) throw new AppError(500, "No fue posible guardar el archivo.");
    await fs.promises.mkdir(path.dirname(destino), { recursive: true });
    await fs.promises.writeFile(destino, archivo.buffer);
    archivo.path = destino;
    return clave;
  }

  async function borrar(clave, { bucket } = {}) {
    if (!clave) return;
    if (usaSupabase()) {
      const { error } = await cliente().storage.from(nombreBucket(bucket)).remove([clave]);
      if (error) return;
      return;
    }
    const ruta = rutaSegura(clave);
    if (ruta) await fs.promises.unlink(ruta).catch(() => {});
  }

  // Si el archivo aun no se persistio (error de validacion), solo borra el temporal en disco.
  async function descartar(archivo, { bucket } = {}) {
    if (!archivo) return;
    if (archivo.storageKey) return borrar(archivo.storageKey, { bucket });
    if (archivo.path) await fs.promises.unlink(archivo.path).catch(() => {});
  }

  async function descartarVarios(archivos = [], opts = {}) {
    await Promise.all((archivos || []).map((a) => descartar(a, opts)));
  }

  async function existe(clave, { bucket } = {}) {
    if (!clave) return false;
    if (usaSupabase()) {
      const dir = clave.includes("/") ? clave.slice(0, clave.lastIndexOf("/")) : "";
      const nombre = clave.includes("/") ? clave.slice(clave.lastIndexOf("/") + 1) : clave;
      const { data, error } = await cliente().storage.from(nombreBucket(bucket)).list(dir, { search: nombre, limit: 10 });
      if (error || !data) return false;
      return data.some((f) => f.name === nombre);
    }
    const ruta = rutaSegura(clave);
    return Boolean(ruta) && fs.existsSync(ruta);
  }

  async function leer(clave, { bucket } = {}) {
    if (!clave) return null;
    if (usaSupabase()) {
      const { data, error } = await cliente().storage.from(nombreBucket(bucket)).download(clave);
      if (error || !data) return null;
      return Buffer.from(await data.arrayBuffer());
    }
    const ruta = rutaSegura(clave);
    if (!ruta) return null;
    try {
      return await fs.promises.readFile(ruta);
    } catch {
      return null;
    }
  }

  async function enviar(res, { clave, bucket, nombre, tipo, cache = "no-store", headers = {}, mensaje404 = "Archivo no disponible." } = {}) {
    if (!clave) {
      if (!res.headersSent) res.status(404).json({ statusCode: 404, message: mensaje404, error: "Not Found" });
      return;
    }

    const aplicarCabeceras = () => {
      Object.entries(headers).forEach(([k, v]) => res.set(k, v));
      if (tipo) res.set("Content-Type", tipo);
      if (nombre) res.set("Content-Disposition", `inline; filename="${encodeURIComponent(nombre)}"`);
      if (cache) res.set("Cache-Control", cache);
    };

    if (!usaSupabase()) {
      const ruta = rutaSegura(clave);
      if (!ruta || !fs.existsSync(ruta)) {
        if (!res.headersSent) res.status(404).json({ statusCode: 404, message: mensaje404, error: "Not Found" });
        return;
      }
      aplicarCabeceras();
      return res.sendFile(ruta, (err) => {
        if (err && !res.headersSent) res.status(404).json({ statusCode: 404, message: mensaje404, error: "Not Found" });
      });
    }

    const buffer = await leer(clave, { bucket });
    if (!buffer) {
      if (!res.headersSent) res.status(404).json({ statusCode: 404, message: mensaje404, error: "Not Found" });
      return;
    }
    aplicarCabeceras();
    return res.status(200).send(buffer);
  }

  function urlPublica(clave) {
    if (!clave || !usaSupabase()) return null;
    const c = config();
    const base = valor(c.supabaseUrl).replace(/\/$/, "");
    return `${base}/storage/v1/object/public/${nombreBucket("publico")}/${clave}`;
  }

  return {
    usaSupabase,
    nombreBucket,
    motorMulter,
    guardar,
    borrar,
    descartar,
    descartarVarios,
    existe,
    leer,
    enviar,
    urlPublica,
    rutaSegura,
    claveDesdeRuta,
    nombreDe,
  };
}

let instancia;
function almacenamiento() {
  if (!instancia) instancia = crearAlmacenamiento();
  return instancia;
}

module.exports = {
  crearAlmacenamiento,
  get almacenamiento() {
    return almacenamiento();
  },
};
