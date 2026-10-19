const { LibroExcel } = require("./LibroExcel");

// Reporte del periodo para el personal: estudiantes, grupos y asistencia.
class ReporteHorasExcel extends LibroExcel {
  async generar({ periodo, requeridas, estudiantes, grupos, asistencias }) {
    this.hojaEstudiantes(periodo, requeridas, estudiantes);
    this.hojaGrupos(grupos);
    this.hojaAsistencia(asistencias);
    return this.buffer();
  }

  hojaEstudiantes(periodo, requeridas, estudiantes) {
    const h = this.hoja(
      "ESTUDIANTES",
      [
        { titulo: "Estudiante", clave: "nombre", ancho: 32, valor: (f) => f.nombre },
        { titulo: "Correo", clave: "email", ancho: 34, valor: (f) => f.email },
        { titulo: `Horas ${periodo}`, clave: "periodo", ancho: 12, valor: (f) => f.horasPeriodo },
        { titulo: "Horas acumuladas", clave: "total", ancho: 14, valor: (f) => f.total },
        { titulo: "Horas requeridas", clave: "req", ancho: 14, valor: () => requeridas },
        { titulo: "Avance", clave: "avance", ancho: 10, valor: (f) => f.porcentaje / 100 },
        { titulo: "Estado", clave: "estado", ancho: 14, valor: (f) => (f.cumplido ? "Cumplió" : "En curso") },
        { titulo: "Grupos activos", clave: "grupos", ancho: 40, valor: (f) => f.gruposActivos.join("; ") },
      ],
      estudiantes
    );
    h.getColumn("avance").numFmt = "0%";
    this.resaltar(h, "estado", "Cumplió", "FFC8EBD9");
  }

  hojaGrupos(grupos) {
    this.hoja(
      "GRUPOS",
      [
        { titulo: "Disciplina", clave: "disciplina", ancho: 18, valor: (f) => f.disciplina?.nombre },
        { titulo: "Grupo", clave: "nombre", ancho: 26, valor: (f) => f.nombre },
        { titulo: "Instructor", clave: "instructor", ancho: 24, valor: (f) => f.instructor },
        { titulo: "Lugar", clave: "lugar", ancho: 22, valor: (f) => f.lugar },
        { titulo: "Horario", clave: "horario", ancho: 34, valor: (f) => f.horarioTexto },
        { titulo: "Cupo", clave: "cupo", ancho: 8, valor: (f) => f.cupo },
        { titulo: "Inscritos", clave: "inscritos", ancho: 10, valor: (f) => f.inscritos },
        { titulo: "Sesiones", clave: "sesiones", ancho: 10, valor: (f) => f.sesiones },
        { titulo: "Horas dictadas", clave: "horas", ancho: 12, valor: (f) => f.horasDictadas },
      ],
      grupos
    );
  }

  hojaAsistencia(asistencias) {
    this.hoja(
      "ASISTENCIA",
      [
        { titulo: "Fecha", clave: "fecha", ancho: 12, valor: (f) => f.fecha },
        { titulo: "Disciplina", clave: "disciplina", ancho: 18, valor: (f) => f.disciplina },
        { titulo: "Grupo", clave: "grupo", ancho: 26, valor: (f) => f.grupo },
        { titulo: "Estudiante", clave: "nombre", ancho: 30, valor: (f) => f.nombre },
        { titulo: "Correo", clave: "email", ancho: 32, valor: (f) => f.email },
        { titulo: "Asistió", clave: "presente", ancho: 9, valor: (f) => (f.presente ? "Sí" : "No") },
        { titulo: "Horas", clave: "horas", ancho: 8, valor: (f) => (f.presente ? f.horas : 0) },
      ],
      asistencias
    );
  }
}

module.exports = { ReporteHorasExcel };
