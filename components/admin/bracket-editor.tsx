"use client";

import { useState } from "react";
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent,
  PointerSensor, useSensor, useSensors, DragOverlay, closestCenter,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, X, Trophy, Users } from "lucide-react";

export interface PreviewPair {
  registrationId: string;
  player1Name:    string;
  player2Name:    string | null;
  spaAvg:         number;
}

export interface PreviewGroup {
  name:  string;
  pairs: PreviewPair[];
}

interface Props {
  groups:       PreviewGroup[];
  totalMatches: number;
  isGroups:     boolean;
  saving:       boolean;
  onConfirm:    (customGroups: string[][]) => void;
  onCancel:     () => void;
}

function PairCard({ pair, isDragging }: { pair: PreviewPair; isDragging?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-all ${
      isDragging
        ? "bg-[#D4AF37]/10 border-[#D4AF37] shadow-lg"
        : "bg-secondary border-border hover:border-[#D4AF37]/40"
    }`}>
      <GripVertical size={14} className="text-muted-foreground shrink-0 cursor-grab" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{pair.player1Name}</p>
        {pair.player2Name && (
          <p className="text-xs text-muted-foreground truncate">{pair.player2Name}</p>
        )}
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{pair.spaAvg} SPA</span>
    </div>
  );
}

function SortablePair({ pair }: { pair: PreviewPair }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pair.registrationId,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
    >
      <PairCard pair={pair} />
    </div>
  );
}

export function BracketEditor({ groups: initialGroups, isGroups, saving, onConfirm, onCancel }: Props) {
  const [groups,      setGroups]      = useState<PreviewGroup[]>(initialGroups);
  const [activePair,  setActivePair]  = useState<PreviewPair | null>(null);

  // Recalcular partidos en tiempo real según distribución actual
  const currentMatches = isGroups
    ? groups.reduce((sum, g) => sum + (g.pairs.length * (g.pairs.length - 1)) / 2, 0)
    : Math.ceil(groups.reduce((s, g) => s + g.pairs.length, 0) / 2);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const findGroup = (registrationId: string) =>
    groups.findIndex((g) => g.pairs.some((p) => p.registrationId === registrationId));

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    const gIdx = findGroup(id);
    if (gIdx >= 0) setActivePair(groups[gIdx].pairs.find((p) => p.registrationId === id) ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromGroup = findGroup(active.id as string);
    const toGroup   = findGroup(over.id as string);
    if (fromGroup === -1 || toGroup === -1 || fromGroup === toGroup) return;

    setGroups((prev) => {
      const next = prev.map((g) => ({ ...g, pairs: [...g.pairs] }));
      const pair = next[fromGroup].pairs.find((p) => p.registrationId === active.id)!;
      next[fromGroup].pairs = next[fromGroup].pairs.filter((p) => p.registrationId !== active.id);
      const overIdx = next[toGroup].pairs.findIndex((p) => p.registrationId === over.id);
      next[toGroup].pairs.splice(overIdx >= 0 ? overIdx : next[toGroup].pairs.length, 0, pair);
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActivePair(null);
    if (!over || active.id === over.id) return;

    const gIdx = findGroup(active.id as string);
    if (gIdx === -1) return;

    setGroups((prev) => {
      const next = prev.map((g) => ({ ...g, pairs: [...g.pairs] }));
      const pairs = next[gIdx].pairs;
      const from  = pairs.findIndex((p) => p.registrationId === active.id);
      const to    = pairs.findIndex((p) => p.registrationId === over.id);
      if (from === -1 || to === -1) return prev;
      const [moved] = pairs.splice(from, 1);
      pairs.splice(to, 0, moved);
      return next;
    });
  };

  const groupValidation = groups.map((g) => ({
    valid: g.pairs.length >= 3,
    count: g.pairs.length,
    name:  g.name,
  }));
  const allValid = groupValidation.every((g) => g.valid);

  const handleConfirm = () => {
    onConfirm(groups.map((g) => g.pairs.map((p) => p.registrationId)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-4xl bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <h2 className="font-heading text-lg text-foreground">Revisar distribución de grupos</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Arrastra las parejas entre grupos para ajustar la distribución antes de confirmar.
              {isGroups && ` Se generarán ${currentMatches} partidos de grupos.`}
            </p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Groups */}
        <div className="overflow-y-auto flex-1 p-5">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className={`grid gap-4 ${groups.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : groups.length <= 4 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-3"}`}>
              {groups.map((group, gIdx) => {
                const validation = groupValidation[gIdx];
                return (
                  <div
                    key={group.name}
                    className={`bg-background border rounded-lg p-3 space-y-2 ${
                      !validation.valid ? "border-red-500/50" : "border-border"
                    }`}
                  >
                    {/* Group header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center">
                          <Trophy size={11} className="text-[#D4AF37]" />
                        </div>
                        <span className="text-sm font-semibold text-foreground">{group.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users size={11} className={validation.valid ? "text-muted-foreground" : "text-red-400"} />
                        <span className={`text-xs ${validation.valid ? "text-muted-foreground" : "text-red-400 font-medium"}`}>
                          {validation.count} {validation.count === 1 ? "pareja" : "parejas"}
                          {!validation.valid && " (mín. 3)"}
                        </span>
                      </div>
                    </div>

                    {/* Pairs */}
                    <SortableContext
                      items={group.pairs.map((p) => p.registrationId)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-1.5 min-h-[60px]">
                        {group.pairs.map((pair) => (
                          <SortablePair key={pair.registrationId} pair={pair} />
                        ))}
                        {group.pairs.length === 0 && (
                          <div className="h-14 rounded-md border border-dashed border-border flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">Suelta aquí</span>
                          </div>
                        )}
                      </div>
                    </SortableContext>
                  </div>
                );
              })}
            </div>

            <DragOverlay>
              {activePair && <PairCard pair={activePair} isDragging />}
            </DragOverlay>
          </DndContext>

          {!allValid && (
            <p className="mt-3 text-xs text-red-400 text-center">
              Todos los grupos deben tener al menos 3 parejas para poder confirmar.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-border shrink-0">
          <div className="text-xs text-muted-foreground">
            {groups.reduce((s, g) => s + g.pairs.length, 0)} parejas · {groups.length} grupos · {currentMatches} partidos
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!allValid || saving}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Confirmar y generar cuadro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
