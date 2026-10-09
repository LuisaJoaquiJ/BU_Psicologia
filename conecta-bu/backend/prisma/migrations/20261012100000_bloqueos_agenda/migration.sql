-- Tiempo no disponible del personal (compromisos, incapacidad, permisos...).
CREATE TABLE "bloqueos_agenda" (
    "id" TEXT NOT NULL,
    "modulo" VARCHAR(40) NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "todoElDia" BOOLEAN NOT NULL DEFAULT true,
    "horaInicio" TIME,
    "horaFin" TIME,
    "motivo" VARCHAR(60) NOT NULL,
    "detalle" VARCHAR(300),
    "creadoPor" VARCHAR(200),
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueos_agenda_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bloqueos_agenda_modulo_fechaInicio_idx" ON "bloqueos_agenda"("modulo", "fechaInicio");
