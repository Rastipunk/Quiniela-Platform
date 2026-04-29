-- Per-pool slot configuration as JSON array of integers.
--
-- The /empresas quote panel now lets requesters add multiple lines so
-- they can specify a different slot count per pool (e.g. 50/80/30 for
-- three departments). We store the structured array here and keep the
-- existing scalar slotsPerPool populated only when all entries are
-- equal — that way back-compat queries still work and reporting can
-- read either column safely.
--
-- Example values:
--   '[50]'           — single pool, 50 slots
--   '[50, 50, 50]'   — three pools all with 50 slots
--   '[50, 80, 30]'   — three pools, different sizes

ALTER TABLE "OrganizationInquiry"
  ADD COLUMN "poolsConfigJson" TEXT;
