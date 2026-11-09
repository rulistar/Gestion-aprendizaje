-- CreateEnum
CREATE TYPE "sync_target" AS ENUM ('PROJECT', 'PHASE', 'TASK');

-- CreateEnum
CREATE TYPE "sync_outbox_status" AS ENUM ('PENDING', 'FAILED');

-- AlterTable
ALTER TABLE "elements" ADD COLUMN     "sync_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "sync_links" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "element_id" UUID NOT NULL,
    "node_id" UUID,
    "target" "sync_target" NOT NULL,
    "remote_id" TEXT NOT NULL,
    "sent_hash" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sync_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_outbox" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "element_id" UUID NOT NULL,
    "status" "sync_outbox_status" NOT NULL DEFAULT 'PENDING',
    "changed_at" TIMESTAMPTZ(3) NOT NULL,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failing_since" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sync_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_links_element_id_idx" ON "sync_links"("element_id");

-- CreateIndex
CREATE UNIQUE INDEX "sync_links_element_project_key" ON "sync_links"("element_id") WHERE ("node_id" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "sync_links_node_key" ON "sync_links"("node_id");

-- CreateIndex
CREATE UNIQUE INDEX "sync_outbox_element_id_key" ON "sync_outbox"("element_id");

-- CreateIndex
CREATE INDEX "sync_outbox_status_next_attempt_at_idx" ON "sync_outbox"("status", "next_attempt_at");

-- AddForeignKey
ALTER TABLE "sync_links" ADD CONSTRAINT "sync_links_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_outbox" ADD CONSTRAINT "sync_outbox_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
