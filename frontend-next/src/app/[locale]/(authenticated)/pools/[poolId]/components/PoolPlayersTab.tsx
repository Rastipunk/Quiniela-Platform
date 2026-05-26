"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { colors, radii } from "@/lib/theme";
import type { PoolOverview } from "@/lib/api";
import type { ExpulsionModalData } from "./poolTypes";
import { MemberManagement } from "./admin/MemberManagement";
import { ExpulsionModal } from "./admin/ExpulsionModal";
import { PendingJoinRequests } from "./admin/PendingJoinRequests";
import { CorporateEmployeeManager } from "@/components/CorporateEmployeeManager";
import { PoolInviteCodeManager } from "@/components/PoolInviteCodeManager";

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
  userTimezone: string | null;
  /**
   * Pending-approval data lifted from the pool page so we can show
   * <PendingJoinRequests/> at the top of the Players tab. The host
   * lands here whenever the sidebar badge fires; we don't want them
   * to also have to switch to Admin to see who's waiting.
   */
  pendingMembers: any[];
  loadPendingMembers: () => Promise<void>;
  refetchNotifications: () => void;
}

export function PoolPlayersTab({
  poolId, token, overview, isMobile,
  busyKey, setBusyKey, error, setError, friendlyError, reload,
  userTimezone, pendingMembers, loadPendingMembers, refetchNotifications,
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
      {/* Pending join requests — host-only; renders nothing when there are no
          pending members so non-host viewers and clean pools don't get a hole
          at the top of the tab. */}
      {overview.permissions.canManageResults && (
        <PendingJoinRequests
          poolId={poolId} token={token} pendingMembers={pendingMembers}
          busyKey={busyKey} setBusyKey={setBusyKey} setError={setError}
          friendlyError={friendlyError} userTimezone={userTimezone}
          reload={reload} refetchNotifications={refetchNotifications}
          loadPendingMembers={loadPendingMembers}
        />
      )}

      {/* Corporate: Excel invite flow */}
      {isCorporate && (
        <CorporateEmployeeManager
          poolId={poolId}
          token={token}
          isMobile={isMobile}
          maxParticipants={overview.pool.maxParticipants ?? undefined}
          currentMembers={overview.counts.membersActive}
        />
      )}

      {/* Corporate: shareable-link invite flow (sits between email
          panel and player roster — disclaimer-backed, see
          CORPORATE_INVITES_AUDIT.md §6). */}
      {isCorporate && overview.permissions.canInvite && (
        <PoolInviteCodeManager
          poolId={poolId}
          token={token}
          isMobile={isMobile}
          maxParticipants={overview.pool.maxParticipants ?? undefined}
          currentMembers={overview.counts.membersActive}
          organizationName={overview.pool.organization?.name ?? ""}
        />
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
