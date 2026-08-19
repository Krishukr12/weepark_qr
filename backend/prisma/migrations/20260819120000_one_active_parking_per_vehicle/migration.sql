-- One active parking session per vehicle (enforced at the database).
CREATE UNIQUE INDEX IF NOT EXISTS parking_entries_one_active_per_vehicle
ON "parking_entries" ("vehicleId")
WHERE status IN ('PARKED', 'PICKUP_REQUESTED', 'PICKUP_IN_PROGRESS');
