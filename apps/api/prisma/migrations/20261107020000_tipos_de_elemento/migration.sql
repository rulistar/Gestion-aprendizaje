-- CreateTable
CREATE TABLE "element_types" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "labels" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "element_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "element_types_workspace_id_idx" ON "element_types"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "element_types_workspace_name_active_key" ON "element_types"("workspace_id", "name") WHERE ("archived_at" IS NULL);

-- AddForeignKey
ALTER TABLE "element_types" ADD CONSTRAINT "element_types_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_types" ADD CONSTRAINT "element_types_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_types" ADD CONSTRAINT "element_types_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tipos iniciales para los espacios que ya existían (los nuevos los reciben al crearse).
-- gen_random_uuid() es v4: PostgreSQL 17 no genera v7. Estas filas se ordenan por "position".
INSERT INTO "element_types" ("id", "workspace_id", "name", "labels", "position", "updated_at")
SELECT gen_random_uuid(), w."id", v."name", v."labels"::jsonb, v."position", CURRENT_TIMESTAMP
FROM "workspaces" w
CROSS JOIN (VALUES
  ('Curso', '{}', 0),
  ('Lectura', '{"platform": "Editorial"}', 1),
  ('Otro', '{}', 2)
) AS v("name", "labels", "position");
