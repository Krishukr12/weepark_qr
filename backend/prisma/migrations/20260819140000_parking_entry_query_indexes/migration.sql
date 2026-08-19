-- Speed up org-scoped history, occupancy batching, and dashboard aggregates.
CREATE INDEX IF NOT EXISTS "parking_entries_organizationId_parkedAt_idx"
ON "parking_entries" ("organizationId", "parkedAt");

CREATE INDEX IF NOT EXISTS "parking_entries_organizationId_siteId_status_idx"
ON "parking_entries" ("organizationId", "siteId", "status");
