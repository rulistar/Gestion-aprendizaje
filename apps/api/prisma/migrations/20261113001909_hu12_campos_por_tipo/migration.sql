-- AlterTable
ALTER TABLE "element_types" ADD COLUMN     "hidden_fields" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Los tipos iniciales de los espacios que ya existen quedan como los pidió el PO (2026-11-12).
-- Solo los que conservan su nombre original; si alguien ya puso un nombre propio, se respeta.
UPDATE "element_types"
SET "hidden_fields" = ARRAY['sponsor', 'category', 'level', 'durationWeeks', 'daysPerWeek', 'hoursPerDay'],
    "labels" = jsonb_build_object('name', 'Nombre del libro') || "labels"
WHERE "name" = 'Lectura';

UPDATE "element_types"
SET "hidden_fields" = ARRAY['genre', 'pages']
WHERE "name" IN ('Curso', 'Otro');
