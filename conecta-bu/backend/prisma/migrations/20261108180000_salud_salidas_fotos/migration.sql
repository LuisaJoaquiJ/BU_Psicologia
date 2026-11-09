-- CreateTable
CREATE TABLE "salud_salidas_fotos" (
    "id" TEXT NOT NULL,
    "salidaId" TEXT NOT NULL,
    "archivo" VARCHAR(60) NOT NULL,
    "nombreOriginal" VARCHAR(255) NOT NULL,
    "tipoMime" VARCHAR(100) NOT NULL,
    "fechaSubida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salud_salidas_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salud_salidas_fotos_salidaId_idx" ON "salud_salidas_fotos"("salidaId");

-- AddForeignKey
ALTER TABLE "salud_salidas_fotos" ADD CONSTRAINT "salud_salidas_fotos_salidaId_fkey" FOREIGN KEY ("salidaId") REFERENCES "salud_salidas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
