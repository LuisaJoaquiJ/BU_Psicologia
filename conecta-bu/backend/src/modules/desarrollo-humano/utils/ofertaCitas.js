const { prisma } = require("../../../config/prisma");
const { hoyBogota } = require("../../../common/utils/fechas");
const { cruza } = require("./agenda");

// Atención fija de Desarrollo Humano: lunes a viernes, de 8:00 a 12:00 y de
// 1:00 a 6:00, en citas de una hora. El personal no publica ese horario;
// cancela el día o las horas en las que no puede atender.
const HORIZONTE_DIAS = 16 * 7;
const FRANJAS = [
  ["08:00", "09:00"],
  ["09:00", "10:00"],
  ["10:00", "11:00"],
  ["11:00", "12:00"],
  ["13:00", "14:00"],
  ["14:00", "15:00"],
  ["15:00", "16:00"],
  ["16:00", "17:00"],
  ["17:00", "18:00"],
];

let enCurso = null;

function ofertaActiva() {
  if (process.env.OFERTA_CITAS_FIJA === "0") return false;
  if (process.env.OFERTA_CITAS_FIJA === "1") return true;
  return process.env.NODE_ENV !== "test";
}

function hora(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, m, 0));
}

function iso(fecha) {
  return new Date(fecha).toISOString().slice(0, 10);
}

function elegirServicio(servicios) {
  return (
    servicios.find((s) => /orientaci|individual|psicol/i.test(s.nombre || "")) ||
    servicios[0] ||
    null
  );
}

function solapa(existentes, inicio, fin) {
  return existentes.some((h) => h.horaInicio < fin && h.horaFin > inicio);
}

// Crea las citas que faltan dentro del horizonte. Si el día o la hora ya
// tiene un horario (libre, ocupado o cerrado), no lo toca. Tampoco crea
// horas que caen en un tiempo marcado como no disponible.
async function correr() {
  const servicios = await prisma.servicioDesarrollo.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
  });
  let servicio = elegirServicio(servicios);
  if (!servicio) {
    servicio = await prisma.servicioDesarrollo.create({
      data: {
        nombre: "Orientación psicológica individual",
        descripcion:
          "Acompañamiento personalizado. Atención de lunes a viernes, de 8:00 a. m. a 12:00 p. m. y de 1:00 p. m. a 6:00 p. m.",
        activo: true,
      },
    });
  }

  const desde = hoyBogota();
  const hasta = new Date(desde);
  hasta.setUTCDate(hasta.getUTCDate() + HORIZONTE_DIAS);

  const [horarios, bloqueos] = await Promise.all([
    prisma.horarioDesarrollo.findMany({
      where: { servicioId: servicio.id, fecha: { gte: desde, lte: hasta } },
      select: { fecha: true, horaInicio: true, horaFin: true, sinCita: true },
    }),
    prisma.bloqueoDesarrollo.findMany({
      where: { fechaFin: { gte: desde }, fechaInicio: { lte: hasta } },
    }),
  ]);

  const porDia = new Map();
  for (const h of horarios) {
    if (h.sinCita) continue;
    const clave = iso(h.fecha);
    if (!porDia.has(clave)) porDia.set(clave, []);
    porDia.get(clave).push(h);
  }

  const franjas = FRANJAS.map(([inicio, fin]) => ({ horaInicio: hora(inicio), horaFin: hora(fin) }));
  const nuevos = [];
  for (let i = 0; i <= HORIZONTE_DIAS; i += 1) {
    const fecha = new Date(desde);
    fecha.setUTCDate(desde.getUTCDate() + i);
    const dia = fecha.getUTCDay();
    if (dia === 0 || dia === 6) continue;
    const ya = porDia.get(iso(fecha)) || [];
    for (const franja of franjas) {
      if (solapa(ya, franja.horaInicio, franja.horaFin)) continue;
      if (bloqueos.some((b) => cruza(b, fecha, franja.horaInicio, franja.horaFin))) continue;
      nuevos.push({
        servicioId: servicio.id,
        fecha: new Date(fecha),
        horaInicio: new Date(franja.horaInicio),
        horaFin: new Date(franja.horaFin),
        cupo: 1,
        ocupado: false,
        sinCita: false,
      });
    }
  }

  for (let i = 0; i < nuevos.length; i += 100) {
    await prisma.horarioDesarrollo.createMany({ data: nuevos.slice(i, i + 100) });
  }
  return { creados: nuevos.length, servicio: servicio.nombre };
}

function asegurarOfertaCitas() {
  if (!ofertaActiva()) return Promise.resolve({ creados: 0 });
  if (!enCurso) {
    enCurso = correr().finally(() => {
      enCurso = null;
    });
  }
  return enCurso;
}

module.exports = { asegurarOfertaCitas, FRANJAS, HORIZONTE_DIAS };
