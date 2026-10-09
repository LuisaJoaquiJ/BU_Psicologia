-- CreateTable
CREATE TABLE "accesos_modulo" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "modulo" VARCHAR(40) NOT NULL,
    "asignadoPor" VARCHAR(120),
    "fechaAsignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accesos_modulo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accesos_modulo_email_idx" ON "accesos_modulo"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accesos_modulo_email_modulo_key" ON "accesos_modulo"("email", "modulo");

-- Datos: nuevo rol SuperAdministrador.
INSERT INTO "roles" ("id", "nombre") VALUES (gen_random_uuid()::text, 'SuperAdministrador')
ON CONFLICT ("nombre") DO NOTHING;

-- Datos: los administradores que ya existian conservan el acceso al modulo
-- de Desarrollo humano y orientacion.
INSERT INTO "accesos_modulo" ("id", "email", "modulo", "asignadoPor")
SELECT gen_random_uuid()::text, lower(u."emailInstitucional"), 'desarrollo-humano', 'migracion'
FROM "usuarios" u JOIN "roles" r ON r."id" = u."rolId"
WHERE r."nombre" = 'Administrador'
ON CONFLICT ("email", "modulo") DO NOTHING;

-- Datos: el rol "Salud" (version anterior del modulo) pasa a ser personal
-- (Administrador) con acceso solo a Salud integral.
INSERT INTO "accesos_modulo" ("id", "email", "modulo", "asignadoPor")
SELECT gen_random_uuid()::text, lower(u."emailInstitucional"), 'salud', 'migracion'
FROM "usuarios" u JOIN "roles" r ON r."id" = u."rolId"
WHERE r."nombre" = 'Salud'
ON CONFLICT ("email", "modulo") DO NOTHING;

UPDATE "usuarios" SET "rolId" = (SELECT "id" FROM "roles" WHERE "nombre" = 'Administrador')
WHERE "rolId" IN (SELECT "id" FROM "roles" WHERE "nombre" = 'Salud')
  AND EXISTS (SELECT 1 FROM "roles" WHERE "nombre" = 'Administrador');

DELETE FROM "roles" WHERE "nombre" = 'Salud'
  AND NOT EXISTS (SELECT 1 FROM "usuarios" u WHERE u."rolId" = "roles"."id");
