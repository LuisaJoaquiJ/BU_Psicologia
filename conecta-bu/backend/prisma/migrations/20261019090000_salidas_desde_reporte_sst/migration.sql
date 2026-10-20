-- Una convocatoria de inscripcion puede nacer de un reporte SST de salida
-- de estudiantes (una por reporte). Si el reporte se borra, la convocatoria
-- queda sin enlace.
ALTER TABLE "salud_salidas" ADD COLUMN "reporteSstId" TEXT;

CREATE UNIQUE INDEX "salud_salidas_reporteSstId_key" ON "salud_salidas"("reporteSstId");

ALTER TABLE "salud_salidas" ADD CONSTRAINT "salud_salidas_reporteSstId_fkey" FOREIGN KEY ("reporteSstId") REFERENCES "sst_reportes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
