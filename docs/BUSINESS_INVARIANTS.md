# Business invariants

These are enforced in services + Postgres, not only in the UI.

1. **One active parking session per vehicle.** Partial unique index `parking_entries_one_active_per_vehicle` plus `SELECT … FOR UPDATE` in park.
2. **Site and org capacity cannot be exceeded.** Concurrent parks serialize on the site row.
3. **Pickup is 1:1 with a parking entry.** Duplicate GET MY CAR returns 409.
4. **Only one valet can accept a given pickup.** `updateMany` where `status = PENDING`.
5. **Only the accepting valet can complete** (other valets get 403).
6. **Public QR never accepts raw ids.** Park / status / pickup require signed `parkToken` / `sessionToken`.
7. **Public responses have no employee email or phone.**
8. **ORG_ADMIN cannot read another tenant’s employees, vehicles, parking rows, or exports.**
9. **Valets only join Socket.IO rooms for assigned sites.**
10. **Refresh cookies rotate atomically.** Reuse of a rotated refresh token revokes the family after the transaction commits.
11. **Inactive vehicle, employee, organization, or site cannot park.**
12. **Seed never overwrites an existing password hash** and requires `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` (12+).
