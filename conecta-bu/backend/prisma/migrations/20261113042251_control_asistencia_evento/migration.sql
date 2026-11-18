-- CreateTable
CREATE TABLE "control_asistencia_evento" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "abierta" BOOLEAN NOT NULL DEFAULT false,
    "codigo" VARCHAR(64),
    "codigoExpira" TIMESTAMP(3),
    "fechaApertura" TIMESTAMP(3),
    "actualizadoPor" VARCHAR(120),

    CONSTRAINT "control_asistencia_evento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "control_asistencia_evento_eventoId_key" ON "control_asistencia_evento"("eventoId");

-- AddForeignKey
ALTER TABLE "control_asistencia_evento" ADD CONSTRAINT "control_asistencia_evento_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
