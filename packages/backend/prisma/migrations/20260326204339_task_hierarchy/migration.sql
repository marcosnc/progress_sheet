-- AlterTable
ALTER TABLE "TaskDefinition" ADD COLUMN     "parentTaskDefinitionId" TEXT;

-- CreateIndex
CREATE INDEX "TaskDefinition_parentTaskDefinitionId_idx" ON "TaskDefinition"("parentTaskDefinitionId");

-- AddForeignKey
ALTER TABLE "TaskDefinition" ADD CONSTRAINT "TaskDefinition_parentTaskDefinitionId_fkey" FOREIGN KEY ("parentTaskDefinitionId") REFERENCES "TaskDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
