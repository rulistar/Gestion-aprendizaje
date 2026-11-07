-- CreateEnum
CREATE TYPE "node_kind" AS ENUM ('CHAPTER', 'COURSE', 'ACTIVITY');

-- CreateEnum
CREATE TYPE "activity_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'PAUSED', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "element_nodes" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "element_id" UUID NOT NULL,
    "parent_id" UUID,
    "kind" "node_kind" NOT NULL,
    "level" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "type_id" UUID,
    "platform_id" UUID,
    "sponsor_id" UUID,
    "category_id" UUID,
    "level_id" UUID,
    "duration_weeks" DECIMAL(6,2),
    "days_per_week" INTEGER,
    "hours_per_day" DECIMAL(4,2),
    "manual_total_hours" DECIMAL(8,2),
    "status" "element_status",
    "notes" TEXT,
    "activity_type_id" UUID,
    "duration_minutes" INTEGER,
    "activity_status" "activity_status",
    "estimated_start" DATE,
    "estimated_end" DATE,
    "actual_start" DATE,
    "actual_end" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_by_id" UUID,

    CONSTRAINT "element_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "element_nodes_element_id_parent_id_position_idx" ON "element_nodes"("element_id", "parent_id", "position");

-- CreateIndex
CREATE INDEX "element_nodes_workspace_id_idx" ON "element_nodes"("workspace_id");

-- AddForeignKey
ALTER TABLE "element_nodes" ADD CONSTRAINT "element_nodes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_nodes" ADD CONSTRAINT "element_nodes_element_id_fkey" FOREIGN KEY ("element_id") REFERENCES "elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_nodes" ADD CONSTRAINT "element_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "element_nodes"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_nodes" ADD CONSTRAINT "element_nodes_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "element_types"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_nodes" ADD CONSTRAINT "element_nodes_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "catalog_items"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_nodes" ADD CONSTRAINT "element_nodes_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "catalog_items"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_nodes" ADD CONSTRAINT "element_nodes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "catalog_items"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_nodes" ADD CONSTRAINT "element_nodes_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "catalog_items"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_nodes" ADD CONSTRAINT "element_nodes_activity_type_id_fkey" FOREIGN KEY ("activity_type_id") REFERENCES "catalog_items"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_nodes" ADD CONSTRAINT "element_nodes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_nodes" ADD CONSTRAINT "element_nodes_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_nodes" ADD CONSTRAINT "element_nodes_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

