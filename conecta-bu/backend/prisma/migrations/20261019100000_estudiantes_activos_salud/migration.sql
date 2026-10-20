-- Lista de estudiantes activos (matriculados) que Salud integral sube en
-- Excel cada periodo: marca a las personas que estan en la lista vigente.
ALTER TABLE "salud_personas" ADD COLUMN "estudianteActivo" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "salud_personas_estudianteActivo_idx" ON "salud_personas"("estudianteActivo");
