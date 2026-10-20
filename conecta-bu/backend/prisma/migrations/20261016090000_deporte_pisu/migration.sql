-- Modulo Deporte (F-02 PISU): categorias de estudiante y restricciones por
-- disciplina, docentes asignados a grupos, eventos deportivos con inscripcion
-- y comunicados (alertas).

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "categoriaEstudiante" VARCHAR(15);

-- AlterTable
ALTER TABLE "deporte_disciplinas" ADD COLUMN "categorias" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "deporte_grupos" ADD COLUMN "docenteId" TEXT;

-- CreateTable
CREATE TABLE "deporte_docentes" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "telefono" VARCHAR(30),
    "especialidad" VARCHAR(120),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deporte_docentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deporte_eventos" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "tipo" VARCHAR(30) NOT NULL DEFAULT 'Torneo',
    "descripcion" TEXT,
    "disciplinaId" TEXT,
    "fecha" DATE NOT NULL,
    "horaInicio" VARCHAR(5) NOT NULL,
    "horaFin" VARCHAR(5) NOT NULL,
    "lugar" VARCHAR(150),
    "cupo" INTEGER,
    "fechaLimite" DATE,
    "horasReconocidas" DOUBLE PRECISION,
    "categorias" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estado" VARCHAR(15) NOT NULL DEFAULT 'Publicado',
    "creadoPor" VARCHAR(120),
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deporte_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deporte_eventos_inscripciones" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "estado" VARCHAR(15) NOT NULL DEFAULT 'Activa',
    "asistio" BOOLEAN,
    "fechaInscripcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deporte_eventos_inscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deporte_alertas" (
    "id" TEXT NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "mensaje" TEXT NOT NULL,
    "prioridad" VARCHAR(15) NOT NULL DEFAULT 'Informativa',
    "alcance" VARCHAR(15) NOT NULL DEFAULT 'Todos',
    "disciplinaId" TEXT,
    "grupoId" TEXT,
    "autor" VARCHAR(150),
    "autorEmail" VARCHAR(120),
    "vigenteHasta" DATE,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deporte_alertas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deporte_docentes_email_key" ON "deporte_docentes"("email");
CREATE INDEX "deporte_grupos_docenteId_idx" ON "deporte_grupos"("docenteId");
CREATE INDEX "deporte_eventos_fecha_idx" ON "deporte_eventos"("fecha");
CREATE UNIQUE INDEX "deporte_eventos_inscripciones_eventoId_usuarioId_key" ON "deporte_eventos_inscripciones"("eventoId", "usuarioId");
CREATE INDEX "deporte_eventos_inscripciones_usuarioId_idx" ON "deporte_eventos_inscripciones"("usuarioId");
CREATE INDEX "deporte_alertas_fecha_idx" ON "deporte_alertas"("fecha");

-- AddForeignKey
ALTER TABLE "deporte_grupos" ADD CONSTRAINT "deporte_grupos_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "deporte_docentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deporte_eventos" ADD CONSTRAINT "deporte_eventos_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "deporte_disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deporte_eventos_inscripciones" ADD CONSTRAINT "deporte_eventos_inscripciones_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "deporte_eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deporte_eventos_inscripciones" ADD CONSTRAINT "deporte_eventos_inscripciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deporte_alertas" ADD CONSTRAINT "deporte_alertas_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "deporte_disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deporte_alertas" ADD CONSTRAINT "deporte_alertas_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "deporte_grupos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Inventario de implementos deportivos.
CREATE TABLE "deporte_implementos" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(30),
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" TEXT,
    "disciplinaId" TEXT,
    "ubicacion" VARCHAR(120),
    "cantidadTotal" INTEGER NOT NULL DEFAULT 0,
    "cantidadDanada" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deporte_implementos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deporte_prestamos" (
    "id" TEXT NOT NULL,
    "implementoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "tipoResponsable" VARCHAR(15) NOT NULL,
    "responsable" VARCHAR(150) NOT NULL,
    "responsableEmail" VARCHAR(120),
    "grupoId" TEXT,
    "fechaPrestamo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaDevolucionEsperada" DATE NOT NULL,
    "fechaDevolucion" TIMESTAMP(3),
    "devueltosBien" INTEGER,
    "devueltosDanados" INTEGER,
    "perdidos" INTEGER,
    "observacion" VARCHAR(300),
    "registradoPor" VARCHAR(120),

    CONSTRAINT "deporte_prestamos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deporte_movimientos_inventario" (
    "id" TEXT NOT NULL,
    "implementoId" TEXT NOT NULL,
    "tipo" VARCHAR(15) NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motivo" VARCHAR(300),
    "registradoPor" VARCHAR(120),
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deporte_movimientos_inventario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deporte_implementos_codigo_key" ON "deporte_implementos"("codigo");
CREATE INDEX "deporte_prestamos_implementoId_idx" ON "deporte_prestamos"("implementoId");
CREATE INDEX "deporte_movimientos_inventario_implementoId_idx" ON "deporte_movimientos_inventario"("implementoId");

ALTER TABLE "deporte_implementos" ADD CONSTRAINT "deporte_implementos_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "deporte_disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deporte_prestamos" ADD CONSTRAINT "deporte_prestamos_implementoId_fkey" FOREIGN KEY ("implementoId") REFERENCES "deporte_implementos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deporte_movimientos_inventario" ADD CONSTRAINT "deporte_movimientos_inventario_implementoId_fkey" FOREIGN KEY ("implementoId") REFERENCES "deporte_implementos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
