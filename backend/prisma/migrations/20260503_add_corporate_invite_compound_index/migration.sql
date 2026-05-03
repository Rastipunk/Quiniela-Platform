-- Compound index that backs the paginated employee list query in
-- corporateService.listEmployees. The handler filters by poolId
-- (always) plus a multi-select status filter, then orders by
-- createdAtUtc DESC. Without this index Postgres would scan the
-- whole poolId partition even when the host filters to "Pendientes"
-- on a 1k+ employee pool.

CREATE INDEX "CorporateInvite_poolId_status_createdAtUtc_idx"
  ON "CorporateInvite" ("poolId", "status", "createdAtUtc");
