"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { colors, radii } from "@/lib/theme";
import type { PoolOverview } from "@/lib/api";
import type { ExpulsionModalData } from "./poolTypes";
import { MemberManagement } from "./admin/MemberManagement";
import { ExpulsionModal } from "./admin/ExpulsionModal";
import { CorporateEmployeeManager } from "@/components/CorporateEmployeeManager";

interface PoolPlayersTabProps {
  poolId: string;
  token: string;
  overview: PoolOverview;
  isMobile: boolean;
  busyKey: string | null;
  setBusyKey: (key: string | null) => void;
  error: string | null;
  setError: (error: string | null) => void;
  friendlyError: (e: any) => string;
  reload: () => Promise<void>;
}

export function PoolPlayersTab({
  poolId, token, overview, isMobile,
  busyKey, setBusyKey, error, setError, friendlyError, reload,
}: PoolPlayersTabProps) {
  const t = useTranslations("pool");
  const [expulsionModalData, setExpulsionModalData] = useState<ExpulsionModalData | null>(null);

  const isCorporate = !!overview.pool.organizationId;

  return (
    <div style={{
      marginTop: 14,
      padding: isMobile ? 12 : 20,
      border: `1px solid ${colors.border}`,
      borderRadius: radii["3xl"],
      background: colors.white,
    }}>
      {/* Corporate: Excel invite flow */}
      {isCorporate && (
        <CorporateEmployeeManager poolId={poolId} token={token} isMobile={isMobile} />
      )}

      {/* Member management (paginated + search) */}
      <MemberManagement
        poolId={poolId} token={token} overview={overview}
        busyKey={busyKey} setBusyKey={setBusyKey} setError={setError}
        friendlyError={friendlyError} reload={reload}
        setExpulsionModalData={setExpulsionModalData}
      />

      {/* Expulsion modal */}
      {expulsionModalData && (
        <ExpulsionModal
          data={expulsionModalData}
          onClose={() => setExpulsionModalData(null)}
          poolId={poolId} token={token}
          busyKey={busyKey} setBusyKey={setBusyKey}
          setError={setError} friendlyError={friendlyError}
          reload={reload}
        />
      )}
    </div>
  );
}
