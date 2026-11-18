const fs = require("fs");
const os = require("os");
const path = require("path");
const { crearAlmacenamiento } = require("../src/common/storage/almacenamiento");

function configLocal(dir) {
  return {
    saludUploadsDir: dir,
    supabaseUrl: "",
    supabaseServiceRoleKey: "",
    supabaseBucketPublico: "publico",
    supabaseBucketPrivado: "privado",
  };
}

function configRemoto(dir, cliente) {
  return {
    config: {
      saludUploadsDir: dir,
      supabaseUrl: "https://ejemplo.supabase.co",
      supabaseServiceRoleKey: "clave-de-prueba",
      supabaseBucketPublico: "publico",
      supabaseBucketPrivado: "privado",
    },
    cliente,
  };
}

function clienteMock({ store } = { store: new Map() }) {
  const api = {
    uploads: [],
    removes: [],
    downloads: [],
    storage: {
      from(bucket) {
        return {
          async upload(clave, buffer, opts) {
            api.uploads.push({ bucket, clave, buffer, opts });
            store.set(`${bucket}:${clave}`, Buffer.from(buffer));
            return { data: { path: clave }, error: null };
          },
          async remove(claves) {
            api.removes.push({ bucket, claves });
            for (const k of claves) store.delete(`${bucket}:${k}`);
            return { data: claves, error: null };
          },
          async download(clave) {
            api.downloads.push({ bucket, clave });
            const buf = store.get(`${bucket}:${clave}`);
            if (!buf) return { data: null, error: { message: "not found" } };
            return { data: { arrayBuffer: async () => buf }, error: null };
          },
          async list(dir, { search } = {}) {
            const pref = dir ? `${dir}/` : "";
            const names = [...store.keys()]
              .filter((k) => k.startsWith(`${bucket}:`) && k.slice(bucket.length + 1).startsWith(pref))
              .map((k) => k.slice(bucket.length + 1 + pref.length))
              .filter((n) => !n.includes("/") && (!search || n.includes(search)));
            return { data: names.map((name) => ({ name })), error: null };
          },
        };
      },
    },
  };
  return api;
}

describe("almacenamiento (disco local)", () => {
  let dir;
  let almacenamiento;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bu-storage-"));
    almacenamiento = crearAlmacenamiento({ config: configLocal(dir) });
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test("sin credenciales de Supabase usa el disco", () => {
    expect(almacenamiento.usaSupabase()).toBe(false);
  });

  test("guarda un buffer en la carpeta relativa y luego lo borra", async () => {
    const archivo = { buffer: Buffer.from("hola"), mimetype: "image/jpeg", filename: "foto.jpg" };
    const clave = await almacenamiento.guardar(archivo, { carpeta: "eventos", bucket: "publico", extension: ".jpg" });
    expect(clave).toBe("eventos/foto.jpg");
    expect(fs.readFileSync(path.join(dir, clave), "utf8")).toBe("hola");
    expect(await almacenamiento.existe(clave, { bucket: "publico" })).toBe(true);
    expect(await almacenamiento.leer(clave, { bucket: "publico" })).toEqual(Buffer.from("hola"));
    await almacenamiento.borrar(clave, { bucket: "publico" });
    expect(fs.existsSync(path.join(dir, clave))).toBe(false);
  });

  test("rechaza claves que salen de uploads", () => {
    expect(almacenamiento.rutaSegura("../secreto.txt")).toBeNull();
    expect(almacenamiento.rutaSegura("eventos/../../etc/passwd")).toBeNull();
  });

  test("enviar sirve el archivo en modo disco", async () => {
    const archivo = { buffer: Buffer.from("img"), mimetype: "image/png", filename: "a.png" };
    const clave = await almacenamiento.guardar(archivo, { carpeta: "eventos", bucket: "publico", extension: ".png" });
    const res = {
      headersSent: false,
      statusCode: null,
      body: null,
      headers: {},
      set(k, v) { this.headers[k] = v; },
      status(c) { this.statusCode = c; return this; },
      json(b) { this.body = b; return this; },
      sendFile(ruta, cb) { this.body = fs.readFileSync(ruta); this.statusCode = this.statusCode || 200; if (cb) cb(); },
      send(b) { this.body = b; return this; },
    };
    await almacenamiento.enviar(res, { clave, bucket: "publico", tipo: "image/png", cache: "public, max-age=86400" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(Buffer.from("img"));
    expect(res.headers["Content-Type"]).toBe("image/png");
  });
});

describe("almacenamiento (Supabase simulado)", () => {
  let dir;
  let mock;
  let almacenamiento;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bu-storage-"));
    mock = clienteMock();
    almacenamiento = crearAlmacenamiento(configRemoto(dir, mock));
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test("con URL y service role usa Supabase", () => {
    expect(almacenamiento.usaSupabase()).toBe(true);
  });

  test("sube el buffer al bucket y no escribe en disco", async () => {
    const archivo = { buffer: Buffer.from("qr"), mimetype: "image/webp", filename: "x.webp" };
    const clave = await almacenamiento.guardar(archivo, { carpeta: "eventos", bucket: "publico", extension: ".webp" });
    expect(clave).toBe("eventos/x.webp");
    expect(mock.uploads).toHaveLength(1);
    expect(mock.uploads[0]).toMatchObject({ bucket: "publico", clave: "eventos/x.webp" });
    expect(fs.existsSync(path.join(dir, "eventos", "x.webp"))).toBe(false);
    expect(await almacenamiento.existe(clave, { bucket: "publico" })).toBe(true);
    expect(await almacenamiento.leer(clave, { bucket: "publico" })).toEqual(Buffer.from("qr"));
  });

  test("borra del bucket privado y sirve un archivo autenticado", async () => {
    const archivo = { buffer: Buffer.from("pdf"), mimetype: "application/pdf", filename: "e.pdf" };
    const clave = await almacenamiento.guardar(archivo, { carpeta: "evidencias/act-1", bucket: "privado", extension: ".pdf" });
    expect(clave).toBe("evidencias/act-1/e.pdf");
    const res = {
      headersSent: false,
      statusCode: null,
      body: null,
      headers: {},
      set(k, v) { this.headers[k] = v; },
      status(c) { this.statusCode = c; return this; },
      json(b) { this.body = b; return this; },
      send(b) { this.body = b; return this; },
    };
    await almacenamiento.enviar(res, { clave, bucket: "privado", nombre: "planilla.pdf", tipo: "application/pdf", cache: "private, max-age=3600" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(Buffer.from("pdf"));
    expect(res.headers["Cache-Control"]).toBe("private, max-age=3600");
    await almacenamiento.borrar(clave, { bucket: "privado" });
    expect(mock.removes[0]).toEqual({ bucket: "privado", claves: [clave] });
    expect(await almacenamiento.existe(clave, { bucket: "privado" })).toBe(false);
  });

  test("descartar un archivo de memoria sin persistir no llama a Supabase", async () => {
    await almacenamiento.descartar({ buffer: Buffer.from("x"), mimetype: "image/jpeg" }, { bucket: "publico" });
    expect(mock.uploads).toHaveLength(0);
    expect(mock.removes).toHaveLength(0);
  });

  test("arma la URL publica de un objeto", () => {
    expect(almacenamiento.urlPublica("eventos/a.jpg")).toBe(
      "https://ejemplo.supabase.co/storage/v1/object/public/publico/eventos/a.jpg",
    );
  });
});
