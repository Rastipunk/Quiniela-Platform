"use client";

import { colors } from "@/lib/theme";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Team } from "./types";
import { TOUCH_TARGET, mobileInteractiveStyles } from "../../hooks/useIsMobile";
import { useTranslations } from "next-intl";
import { getTeamName } from "@/app/[locale]/(authenticated)/pools/[poolId]/components/poolHelpers";

export const MEDALS = ["🥇", "🥈", "🥉", ""];

// Static team list with medals
export function StaticTeamList({ teams, orderedTeamIds, isMobile }: { teams: Team[]; orderedTeamIds: string[]; isOfficial?: boolean; isMobile?: boolean }) {
  const tTeams = useTranslations("teams");
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const orderedTeams = orderedTeamIds.map((id) => teamMap.get(id)!).filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "0.5rem" : "0.35rem" }}>
      {orderedTeams.map((team, index) => (
        <div
          key={team.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: isMobile ? "0.65rem 0.75rem" : "0.5rem 0.75rem",
            background: colors.white,
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
          }}
        >
          <span style={{ fontSize: 16, width: 24 }}>{MEDALS[index]}</span>
          <span style={{ fontSize: isMobile ? 13 : 12, color: colors.textLighter, width: 20 }}>{index + 1}.</span>
          <span style={{ fontSize: isMobile ? 14 : 13, fontWeight: 500, color: colors.text }}>{getTeamName(team, tTeams)}</span>
        </div>
      ))}
    </div>
  );
}

// Draggable team list
export function DraggableTeamList({
  teams,
  orderedTeamIds,
  onOrderChange,
  disabled,
  isMobile,
}: {
  teams: Team[];
  orderedTeamIds: string[];
  onOrderChange: (ids: string[]) => void;
  disabled: boolean;
  isMobile?: boolean;
}) {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const orderedTeams = orderedTeamIds.map((id) => teamMap.get(id)!).filter(Boolean);

  // Three sensors so reorder works equivalently on every input device:
  //   · PointerSensor with a 5px distance constraint — desktop mouse drag,
  //     the distance threshold filters accidental clicks.
  //   · TouchSensor with a 200ms press-and-hold delay — without this,
  //     iOS Safari and most Android browsers steal the touch for native
  //     scrolling instead of starting the drag, which is why reordering
  //     was completely broken on mobile.
  //   · KeyboardSensor for accessibility (space + arrows).
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || disabled) return;

    const oldIndex = orderedTeams.findIndex((item) => item.id === active.id);
    const newIndex = orderedTeams.findIndex((item) => item.id === over.id);
    const newOrder = arrayMove(orderedTeams, oldIndex, newIndex);

    // Update synchronously. A previous setTimeout(..., 0) here was the
    // root cause of the visible "snap back" on drop: the array update
    // arrived one tick late, so dnd-kit animated transform back to (0,0)
    // FROM the original DOM position before React moved the row to its
    // new index. Calling onOrderChange in the same frame as isDragging
    // flips to false makes the transform reset a no-op visually.
    onOrderChange(newOrder.map((t) => t.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedTeams.map((t) => t.id)} strategy={verticalListSortingStrategy} disabled={disabled}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? "0.5rem" : "0.35rem",
            // Right-side scroll gutter on mobile: the rows have
            // touchAction: none so a finger inside the row blocks
            // page scroll. This gutter leaves a sliver at the right
            // edge that is NOT a sortable item, so swiping there
            // scrolls the page normally.
            paddingRight: isMobile ? 28 : 0,
          }}
        >
          {orderedTeams.map((team, index) => (
            <SortableTeamItem key={team.id} team={team} position={index} disabled={disabled} isMobile={isMobile} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// Sortable team item
function SortableTeamItem({ team, position, disabled, isMobile }: { team: Team; position: number; disabled: boolean; isMobile?: boolean }) {
  const tTeams = useTranslations("teams");
  // Snappier transition (160ms vs. the 250ms default) so siblings
  // rearranging during drag feel responsive instead of "weighty".
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: team.id,
    disabled,
    transition: {
      duration: 160,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
    },
  });

  // CSS.Translate (translation-only) instead of CSS.Transform avoids
  // the brief scaleX/scaleY snap that dnd-kit applies when the drop
  // animation finishes.
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        // Disable the browser's native touch gestures (pan/zoom) on the
        // draggable row so the TouchSensor's press-and-hold activation
        // gets clean events. Without this, iOS especially will hijack
        // touches to scroll the page even when the user is mid-drag.
        touchAction: disabled ? "auto" : "none",
      }}
      {...attributes}
      {...listeners}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: isMobile ? "0.65rem 0.75rem" : "0.5rem 0.75rem",
          background: colors.white,
          border: "1px solid #d1d5db",
          borderRadius: 6,
          cursor: disabled ? "not-allowed" : "grab",
          minHeight: isMobile ? TOUCH_TARGET.comfortable : undefined,
          ...(isMobile ? mobileInteractiveStyles.tapHighlight : {}),
        }}
      >
        <span style={{ fontSize: 16, width: 24 }}>{MEDALS[position]}</span>
        <span style={{ fontSize: isMobile ? 13 : 12, color: colors.textLighter, width: 20 }}>{position + 1}.</span>
        <span style={{ fontSize: isMobile ? 14 : 13, fontWeight: 500, color: colors.text, flex: 1 }}>{getTeamName(team, tTeams)}</span>
        {!disabled && (
          // Drag handle indicator. Larger + bolder on mobile so the
          // affordance is obvious (press-and-hold to reorder).
          <span
            aria-hidden="true"
            style={{
              color: colors.textMuted,
              fontSize: isMobile ? 22 : 14,
              fontWeight: isMobile ? 700 : 400,
              padding: isMobile ? "4px 8px" : 0,
              userSelect: "none",
            }}
          >
            ⋮⋮
          </span>
        )}
      </div>
    </div>
  );
}
