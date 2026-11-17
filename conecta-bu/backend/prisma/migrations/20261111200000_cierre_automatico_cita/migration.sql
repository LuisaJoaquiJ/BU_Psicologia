-- Distingue el "no asistio" del cierre automatico del que registra el personal.
ALTER TABLE "citas_desarrollo" ADD COLUMN "cerradaAutomaticamente" TIMESTAMP(3);

-- Las que ya estaban en No asistio sin registro de asistencia las cerro el sistema.
UPDATE "citas_desarrollo" AS c
SET "cerradaAutomaticamente" = c."fechaActualizacion"
WHERE c.estado = 'NoAsistio'
  AND NOT EXISTS (
    SELECT 1 FROM "asistencias_cita_desarrollo" AS a WHERE a."citaId" = c.id
  );
