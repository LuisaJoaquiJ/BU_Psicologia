// Pruebas unitarias de los calculos del dashboard ampliado (RF-015).
const {
  intervaloWilson,
  tendenciaSemanal,
  mapaDemanda,
  calcularProbabilidades,
  calcularParticipacion,
  calcularOcupacionHorarios,
} = require("../src/modules/estadisticas/analitica");

const fecha = (iso) => new Date(`${iso}T00:00:00.000Z`);
const hora = (h) => new Date(Date.UTC(1970, 0, 1, h, 0, 0));
const cita = (usuarioId, estado, dia, h = 9) => ({ usuarioId, estado, horario: { fecha: fecha(dia), horaInicio: hora(h) } });

describe("intervaloWilson", () => {
  test("sin datos no inventa una probabilidad", () => {
    expect(intervaloWilson(0, 0)).toEqual({ probabilidad: null, bajo: null, alto: null, n: 0 });
  });

  test("calcula la proporcion y un intervalo que la contiene", () => {
    const r = intervaloWilson(8, 10);
    expect(r.probabilidad).toBe(80);
    expect(r.bajo).toBeLessThan(80);
    expect(r.alto).toBeGreaterThan(80);
    expect(r.bajo).toBeCloseTo(49, 0);
    expect(r.alto).toBeCloseTo(94.3, 0);
  });

  test("con mas datos el intervalo se angosta", () => {
    const pocos = intervaloWilson(8, 10);
    const muchos = intervaloWilson(80, 100);
    expect(muchos.alto - muchos.bajo).toBeLessThan(pocos.alto - pocos.bajo);
  });
});

describe("tendenciaSemanal", () => {
  test("agrupa por semana (lunes) y por estado dentro del rango", () => {
    const citas = [
      cita("a", "Atendida", "2026-09-07"), // lunes
      cita("b", "NoAsistio", "2026-09-11"), // viernes, misma semana
      cita("c", "Cancelada", "2026-09-14"),
      cita("d", "Atendida", "2026-10-30"), // fuera del rango
    ];
    const semanas = tendenciaSemanal(citas, { desde: "2026-09-07", hasta: "2026-09-20" });
    expect(semanas.map((s) => s.semana)).toEqual(["2026-09-07", "2026-09-14"]);
    expect(semanas[0]).toMatchObject({ Atendida: 1, NoAsistio: 1, total: 2 });
    expect(semanas[1]).toMatchObject({ Cancelada: 1, total: 1 });
  });

  test("sin filtro devuelve 12 semanas alrededor de hoy", () => {
    expect(tendenciaSemanal([], { hoy: fecha("2026-10-01") })).toHaveLength(12);
  });
});

describe("mapaDemanda", () => {
  test("cuenta citas por dia y hora, sin las canceladas", () => {
    const mapa = mapaDemanda([
      cita("a", "Atendida", "2026-09-07", 9),
      cita("b", "Agendada", "2026-09-14", 9),
      cita("c", "Cancelada", "2026-09-14", 9),
      cita("d", "Atendida", "2026-09-11", 15),
    ]);
    expect(mapa.dias[0]).toBe("Lun");
    expect(mapa.celdas[0][mapa.horas.indexOf(9)]).toBe(2);
    expect(mapa.celdas[4][mapa.horas.indexOf(15)]).toBe(1);
    expect(mapa.maximo).toBe(2);
  });
});

describe("probabilidades y participacion", () => {
  const citas = [
    cita("a", "Atendida", "2026-09-07"),
    cita("a", "Atendida", "2026-09-14"),
    cita("b", "NoAsistio", "2026-09-11"),
    cita("c", "Cancelada", "2026-09-08"),
  ];
  const eventos = [
    {
      inscripciones: [
        { usuarioId: "d", asistencia: { asistio: true } },
        { usuarioId: "a", asistencia: { asistio: false } },
        { usuarioId: "e", asistencia: null },
      ],
    },
  ];

  test("estima asistencia, cancelacion y asistencia por dia", () => {
    const p = calcularProbabilidades(citas, eventos);
    expect(p.asistenciaCita).toMatchObject({ probabilidad: 66.7, n: 3 });
    expect(p.cancelacionCita).toMatchObject({ probabilidad: 25, n: 4 });
    expect(p.asistenciaEvento).toMatchObject({ probabilidad: 50, n: 2 });
    expect(p.asistenciaCitaPorDia.find((d) => d.dia === "Lun")).toMatchObject({ probabilidad: 100, n: 2 });
    expect(p.asistenciaCitaPorDia.find((d) => d.dia === "Vie")).toMatchObject({ probabilidad: 0, n: 1 });
  });

  test("cuenta estudiantes activos y recurrentes", () => {
    expect(calcularParticipacion(citas, eventos, 10)).toEqual({
      estudiantesActivos: 4, // a, b, d, e (c solo cancelo)
      alcance: 40,
      recurrentes: 1, // a tiene 2 citas
      tasaRecurrencia: 50,
    });
  });

  test("ocupacion de horarios", () => {
    expect(calcularOcupacionHorarios([{ ocupado: true }, { ocupado: false }, { ocupado: true }, { ocupado: true }])).toEqual({
      total: 4,
      ocupados: 3,
      libres: 1,
      porcentaje: 75,
    });
  });
});
