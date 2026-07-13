-- CreateTable
CREATE TABLE "organization_site_assignments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_site_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_site_assignments_siteId_idx" ON "organization_site_assignments"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_site_assignments_organizationId_siteId_key" ON "organization_site_assignments"("organizationId", "siteId");

-- AddForeignKey
ALTER TABLE "organization_site_assignments" ADD CONSTRAINT "organization_site_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_site_assignments" ADD CONSTRAINT "organization_site_assignments_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
