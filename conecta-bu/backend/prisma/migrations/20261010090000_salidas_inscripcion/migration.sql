-- Salud integral: salidas publicadas por el personal de Salud y la inscripcion de los estudiantes.

-- CreateTable
CREATE TABLE "salud_salidas" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "destino" VARCHAR(200) NOT NULL,
    "programa" VARCHAR(150),
    "responsable" VARCHAR(200),
    "lugarEncuentro" VARCHAR(200),
    "fechaSalida" DATE NOT NULL,
    "fechaRegreso" DATE NOT NULL,
    "horaSalida" VARCHAR(5),
    "horaRegreso" VARCHAR(5),
    "cupos" INTEGER NOT NULL,
    "costo" INTEGER,
    "infoPago" TEXT,
    "pideComprobante" BOOLEAN NOT NULL DEFAULT false,
    "fechaLimiteInscripcion" DATE NOT NULL,
    "estado" VARCHAR(15) NOT NULL DEFAULT 'Borrador',
    "creadaPor" VARCHAR(120),
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salud_salidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salud_salidas_inscripciones" (
    "id" TEXT NOT NULL,
    "salidaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "correo" VARCHAR(120) NOT NULL,
    "tipoDocumento" VARCHAR(5) NOT NULL DEFAULT 'CC',
    "documento" VARCHAR(30) NOT NULL,
    "programa" VARCHAR(150) NOT NULL,
    "celular" VARCHAR(30) NOT NULL,
    "eps" VARCHAR(120) NOT NULL,
    "contactoEmergencia" VARCHAR(200),
    "telefonoEmergencia" VARCHAR(30),
    "comprobante" VARCHAR(120),
    "comprobanteNombre" VARCHAR(200),
    "estado" VARCHAR(15) NOT NULL DEFAULT 'Pendiente',
    "observacion" TEXT,
    "consentimiento" BOOLEAN NOT NULL DEFAULT false,
    "revisadoPor" VARCHAR(120),
    "fechaRevision" TIMESTAMP(3),
    "fechaInscripcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salud_salidas_inscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salud_salidas_estado_fechaSalida_idx" ON "salud_salidas"("estado", "fechaSalida");
CREATE UNIQUE INDEX "salud_salidas_inscripciones_salidaId_usuarioId_key" ON "salud_salidas_inscripciones"("salidaId", "usuarioId");
CREATE INDEX "salud_salidas_inscripciones_usuarioId_idx" ON "salud_salidas_inscripciones"("usuarioId");

-- AddForeignKey
ALTER TABLE "salud_salidas_inscripciones" ADD CONSTRAINT "salud_salidas_inscripciones_salidaId_fkey" FOREIGN KEY ("salidaId") REFERENCES "salud_salidas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "salud_salidas_inscripciones" ADD CONSTRAINT "salud_salidas_inscripciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
