// Componente para ordenar equipos de un grupo mediante drag-and-drop
// Sprint 2 - Advanced Pick Types System - Preset SIMPLE

import { useState, useEffect } from "react";
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

type Team = {
  id: string;
  name: string;
  flag?: string;
};

type GroupStandingsPickerProps = {
  groupName: string;
  teams: Team[];
  initialOrder?: string[]; // IDs de equipos en orden guardado
  onOrderChange: (teamIds: string[]) => void;
  disabled?: boolean;
};

export function GroupStandingsPicker({
  groupName,
  teams,
  initialOrder,
  onOrderChange,
  disabled = false,
}: GroupStandingsPickerProps) {
  // Ordenar equipos según initialOrder o mantener orden original
  const [orderedTeams, setOrderedTeams] = useState<Team[]>(() => {
    if (initialOrder && initialOrder.length > 0) {
      // Reordenar según el orden guardado
      const teamMap = new Map(teams.map((t) => [t.id, t]));
      return initialOrder.map((id) => teamMap.get(id)!).filter(Boolean);
    }
    return [...teams];
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setOrderedTeams((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newOrder = arrayMove(items, oldIndex, newIndex);

      // Notificar el cambio de orden DESPUÉS de actualizar el estado
      // Usamos setTimeout para evitar el warning de React
      setTimeout(() => {
        onOrderChange(newOrder.map((t) => t.id));
      }, 0);

      return newOrder;
    });
  }

  return (
    <div
      style={{
        padding: "1.5rem",
        background: "white",
        borderRadius: 12,
        border: "2px solid #007bff",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      }}
    >
      <div
        style={{
          marginBottom: "1rem",
          paddingBottom: "0.75rem",
          borderBottom: "2px solid #007bff",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#007bff" }}>
          {groupName}
        </h3>
        <p style={{ margin: "0.5rem 0 0 0", fontSize: 13, color: "#666" }}>
          {disabled
            ? "Orden guardado (bloqueado)"
            : "Arrastra para ordenar del 1° al 4° lugar"}
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedTeams.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
          disabled={disabled}
        >
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {orderedTeams.map((team, index) => (
              <SortableTeamItem
                key={team.id}
                team={team}
                position={index + 1}
                disabled={disabled}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {!disabled && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            background: "#fff3cd",
            borderRadius: 8,
            fontSize: 12,
            color: "#856404",
          }}
        >
          💡 <strong>Tip:</strong> Toca y arrastra cada equipo para cambiar su posición.
          El orden que dejes se guardará como tu predicción.
        </div>
      )}
    </div>
  );
}

type SortableTeamItemProps = {
  team: Team;
  position: number;
  disabled?: boolean;
};

function SortableTeamItem({ team, position, disabled }: SortableTeamItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: team.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const positionColors: Record<number, string> = {
    1: "#ffd700", // Oro
    2: "#c0c0c0", // Plata
    3: "#cd7f32", // Bronce
    4: "#e0e0e0", // Gris
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "1rem",
        background: disabled ? "#f8f9fa" : "white",
        border: `2px solid ${disabled ? "#dee2e6" : "#007bff"}`,
        borderRadius: 10,
        cursor: disabled ? "default" : "grab",
        touchAction: "none",
        userSelect: "none",
      }}
      {...attributes}
      {...listeners}
    >
      {/* Posición */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: positionColors[position] || "#e0e0e0",
          color: position <= 2 ? "#000" : "#666",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        {position}°
      </div>

      {/* Bandera (opcional) */}
      {team.flag && (
        <div style={{ fontSize: 32, flexShrink: 0 }}>{team.flag}</div>
      )}

      {/* Nombre del equipo */}
      <div style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "#333" }}>
        {team.name}
      </div>

      {/* Icono de drag (solo si no está disabled) */}
      {!disabled && (
        <div style={{ fontSize: 20, color: "#999", flexShrink: 0 }}>⋮⋮</div>
      )}
    </div>
  );
}
