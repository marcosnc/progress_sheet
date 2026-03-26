-- CreateTable
CREATE TABLE "LocationTask" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "taskDefinitionId" TEXT NOT NULL,

    CONSTRAINT "LocationTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocationTask_locationId_taskDefinitionId_key" ON "LocationTask"("locationId", "taskDefinitionId");
CREATE INDEX "LocationTask_locationId_idx" ON "LocationTask"("locationId");
CREATE INDEX "LocationTask_taskDefinitionId_idx" ON "LocationTask"("taskDefinitionId");

-- AddForeignKey
ALTER TABLE "LocationTask" ADD CONSTRAINT "LocationTask_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
