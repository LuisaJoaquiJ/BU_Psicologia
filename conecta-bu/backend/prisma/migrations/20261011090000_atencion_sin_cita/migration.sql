-- Atencion sin cita: horarios creados al registrar una atencion a un
-- estudiante que llego sin agendar.
ALTER TABLE "horarios" ADD COLUMN "sinCita" BOOLEAN NOT NULL DEFAULT false;
