-- CreateIndex
CREATE INDEX "PoolMember_poolId_status_idx" ON "PoolMember"("poolId", "status");

-- CreateIndex
CREATE INDEX "Prediction_poolId_matchId_idx" ON "Prediction"("poolId", "matchId");
