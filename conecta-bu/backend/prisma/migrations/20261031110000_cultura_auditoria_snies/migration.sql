-- Auditoria de Cultura (tipo SNIES, fecha y hora, IP) y evidencia de planillas.

ALTER TABLE "cultura_areas" ADD COLUMN "categoria" VARCHAR(40) NOT NULL DEFAULT 'taller';
ALTER TABLE "cultura_eventos" ADD COLUMN "categoria" VARCHAR(40) NOT NULL DEFAULT 'especial';

ALTER TABLE "cultura_inscripciones" ADD COLUMN "tipoSnies" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "cultura_inscripciones" ADD COLUMN "ip" VARCHAR(45);

ALTER TABLE "cultura_eventos_inscripciones" ADD COLUMN "tipoSnies" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "cultura_eventos_inscripciones" ADD COLUMN "ip" VARCHAR(45);

ALTER TABLE "cultura_postulaciones" ADD COLUMN "tipoSnies" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "cultura_postulaciones" ADD COLUMN "ip" VARCHAR(45);

ALTER TABLE "cultura_asistencias" ADD COLUMN "tipoSnies" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "cultura_asistencias" ADD COLUMN "ip" VARCHAR(45);
ALTER TABLE "cultura_asistencias" ADD COLUMN "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "cultura_perfiles" (
    "usuarioId" TEXT NOT NULL,
    "tipoSnies" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "cultura_perfiles_pkey" PRIMARY KEY ("usuarioId")
);

CREATE TABLE "cultura_evidencias" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT,
    "eventoId" TEXT,
    "archivo" VARCHAR(120) NOT NULL,
    "nombreOriginal" VARCHAR(200) NOT NULL,
    "mime" VARCHAR(80) NOT NULL,
    "subidoPor" VARCHAR(120),
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cultura_evidencias_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "cultura_perfiles" ADD CONSTRAINT "cultura_perfiles_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cultura_evidencias" ADD CONSTRAINT "cultura_evidencias_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "cultura_grupos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cultura_evidencias" ADD CONSTRAINT "cultura_evidencias_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "cultura_eventos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "cultura_areas" SET "activa" = false WHERE "nombre" IN ('Danza', 'Música', 'Teatro', 'Artes visuales');

INSERT INTO "cultura_areas" ("id", "nombre", "descripcion", "activa", "categoria") VALUES
    ('c0a10000-0000-4000-8000-000000000011', 'Guitarra', 'Taller de formación.', true, 'taller'),
    ('c0a10000-0000-4000-8000-000000000012', 'Piano', 'Taller de formación.', true, 'taller'),
    ('c0a10000-0000-4000-8000-000000000013', 'Ritmos latinos', 'Taller de formación.', true, 'taller'),
    ('c0a10000-0000-4000-8000-000000000014', 'Danzas folclóricas', 'Taller de formación.', true, 'taller'),
    ('c0a10000-0000-4000-8000-000000000015', 'Expresión corporal y oralidad', 'Taller de formación.', true, 'taller'),
    ('c0a10000-0000-4000-8000-000000000021', 'Uniautónoma Band', 'Grupo representativo de música.', true, 'representativo'),
    ('c0a10000-0000-4000-8000-000000000022', 'Synapsis', 'Grupo representativo de teatro.', true, 'representativo'),
    ('c0a10000-0000-4000-8000-000000000023', 'Grupo de danzas folclóricas', 'Grupo representativo.', true, 'representativo'),
    ('c0a10000-0000-4000-8000-000000000031', 'Día de la secretaria', 'Evento especial.', true, 'especial'),
    ('c0a10000-0000-4000-8000-000000000032', 'Día de la madre, el padre y el profesor', 'Evento especial.', true, 'especial'),
    ('c0a10000-0000-4000-8000-000000000033', 'Semana universitaria', 'Evento especial.', true, 'especial'),
    ('c0a10000-0000-4000-8000-000000000034', 'Halloween', 'Evento especial.', true, 'especial'),
    ('c0a10000-0000-4000-8000-000000000035', 'Amor y amistad', 'Evento especial.', true, 'especial'),
    ('c0a10000-0000-4000-8000-000000000041', 'Pausas creativas', 'Arte itinerante en espacios comunes.', true, 'itinerante'),
    ('c0a10000-0000-4000-8000-000000000051', 'Promoción en colegios y ferias', 'Apoyo a mercadeo y admisiones.', true, 'promocion');
