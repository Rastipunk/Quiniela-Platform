"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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

export const MEDALS = ["🥇", "🥈", "🥉", ""];

// Static team list with medals
export function StaticTeamList({ teams, orderedTeamIds, isMobile }: { teams: Team[]; orderedTeamIds: string[]; isOfficial?: boolean; isMobile?: boolean }) {
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
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            minHeight: isMobile ? TOUCH_TARGET.minimum : undefined,
          }}
        >
          <span style={{ fontSize: 16, width: 24 }}>{MEDALS[index]}</span>
          <span style={{ fontSize: isMobile ? 13 : 12, color: "#6b7280", width: 20 }}>{index + 1}.</span>
          <span style={{ fontSize: isMobile ? 14 : 13, fontWeight: 500, color: "#1f2937" }}>{team.name}</span>
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || disabled) return;

    const oldIndex = orderedTeams.findIndex((item) => item.id === active.id);
    const newIndex = orderedTeams.findIndex((item) => item.id === over.id);
    const newOrder = arrayMove(orderedTeams, oldIndex, newIndex);

    setTimeout(() => {
      onOrderChange(newOrder.map((t) => t.id));
    }, 0);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedTeams.map((t) => t.id)} strategy={verticalListSortingStrategy} disabled={disabled}>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "0.5rem" : "0.35rem" }}>
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: team.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: isMobile ? "0.65rem 0.75rem" : "0.5rem 0.75rem",
          background: "#fff",
          border: "1px solid #d1d5db",
          borderRadius: 6,
          cursor: disabled ? "not-allowed" : "grab",
          minHeight: isMobile ? TOUCH_TARGET.comfortable : undefined,
          ...(isMobile ? mobileInteractiveStyles.tapHighlight : {}),
        }}
      >
        <span style={{ fontSize: 16, width: 24 }}>{MEDALS[position]}</span>
        <span style={{ fontSize: isMobile ? 13 : 12, color: "#6b7280", width: 20 }}>{position + 1}.</span>
        <span style={{ fontSize: isMobile ? 14 : 13, fontWeight: 500, color: "#1f2937", flex: 1 }}>{team.name}</span>
        {!disabled && <span style={{ color: "#9ca3af", fontSize: isMobile ? 18 : 14 }}>⋮⋮</span>}
      </div>
    </div>
  );
}
