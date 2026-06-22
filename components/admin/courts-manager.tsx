"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarOff,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { adminService } from "@/lib/services/admin";
import type { Court, CourtBlock } from "@/types";

const EMPTY_COURT = { name: "", isIndoor: false, isCentral: false };
type CourtForm = typeof EMPTY_COURT;

const EMPTY_BLOCK = {
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  reason: "",
};
type BlockForm = typeof EMPTY_BLOCK;

function CourtRow({
  court,
  clubId,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  court: Court;
  clubId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [showBlocks, setShowBlocks] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [blockForm, setBlockForm] = useState<BlockForm>({ ...EMPTY_BLOCK });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteBlock, setConfirmDeleteBlock] =
    useState<CourtBlock | null>(null);
  const [form, setForm] = useState<CourtForm>({
    name: court.name,
    isIndoor: court.isIndoor,
    isCentral: court.isCentral,
  });

  const { data: blocks = [], isLoading: blocksLoading } = useQuery({
    queryKey: ["court-blocks", clubId, court.id],
    queryFn: () => adminService.courts.blocks.list(clubId, court.id),
    enabled: showBlocks,
  });

  const save = useMutation({
    mutationFn: () =>
      adminService.courts.update(clubId, court.id, {
        name: form.name.trim() || undefined,
        isIndoor: form.isIndoor,
        isCentral: form.isCentral,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-courts", clubId] });
      setEdit(false);
      toast.success("Pista actualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => adminService.courts.remove(clubId, court.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-courts", clubId] });
      toast.success("Pista eliminada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addBlock = useMutation({
    mutationFn: () =>
      adminService.courts.blocks.create(clubId, court.id, {
        startDate: blockForm.startDate,
        endDate: blockForm.endDate || blockForm.startDate,
        startTime: blockForm.startTime || undefined,
        endTime: blockForm.endTime || undefined,
        reason: blockForm.reason.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["court-blocks", clubId, court.id] });
      setBlockForm({ ...EMPTY_BLOCK });
      setShowAddBlock(false);
      toast.success("Bloqueo añadido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeBlock = useMutation({
    mutationFn: (blockId: string) =>
      adminService.courts.blocks.remove(clubId, court.id, blockId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["court-blocks", clubId, court.id] });
      toast.success("Bloqueo eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (edit) {
    return (
      <div className="border border-[#D4AF37]/30 rounded-lg p-3 space-y-2 bg-[rgba(212,175,55,0.04)]">
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Nombre pista"
          className="w-full h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
        />
        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isIndoor}
              onChange={(e) =>
                setForm((f) => ({ ...f, isIndoor: e.target.checked }))
              }
              className="accent-[#D4AF37]"
            />
            Cubierta
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isCentral}
              onChange={(e) =>
                setForm((f) => ({ ...f, isCentral: e.target.checked }))
              }
              className="accent-[#D4AF37]"
            />
            Pista Central
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={() => setEdit(false)}
            className="px-3 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="px-3 py-1 text-xs rounded bg-[#D4AF37] text-[#0C0C0C] font-semibold hover:bg-[#C9A227] disabled:opacity-50 flex items-center gap-1"
          >
            {save.isPending && <Loader2 size={11} className="animate-spin" />}{" "}
            Guardar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-3 py-2 group">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {court.isCentral && (
              <Star
                size={11}
                className="text-[#D4AF37] fill-[#D4AF37] shrink-0"
              />
            )}
            <span className="text-sm font-medium truncate">{court.name}</span>
          </div>
          {court.isIndoor && (
            <p className="text-[10px] text-muted-foreground mt-0.5">Cubierta</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-1 sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity">
          <button
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="p-2 sm:p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed"
            title="Subir pista"
          >
            <ChevronUp size={14} className="sm:hidden" />
            <ChevronUp size={12} className="hidden sm:block" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="p-2 sm:p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed"
            title="Bajar pista"
          >
            <ChevronDown size={14} className="sm:hidden" />
            <ChevronDown size={12} className="hidden sm:block" />
          </button>
          <button
            onClick={() => {
              setShowBlocks((v) => !v);
              setShowAddBlock(false);
            }}
            className="p-2 sm:p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
            title="Gestionar bloqueos"
          >
            <CalendarOff size={14} className="sm:hidden" />
            <CalendarOff size={12} className="hidden sm:block" />
          </button>
          <button
            onClick={() => setEdit(true)}
            className="p-2 sm:p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
            title="Editar pista"
          >
            <Pencil size={14} className="sm:hidden" />
            <Pencil size={12} className="hidden sm:block" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={remove.isPending}
            className="p-2 sm:p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            title="Eliminar pista"
          >
            {remove.isPending ? (
              <Loader2 size={14} className="animate-spin sm:hidden" />
            ) : (
              <Trash2 size={14} className="sm:hidden" />
            )}
            {remove.isPending ? (
              <Loader2 size={12} className="animate-spin hidden sm:block" />
            ) : (
              <Trash2 size={12} className="hidden sm:block" />
            )}
          </button>
        </div>
      </div>

      {showBlocks && (
        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Bloqueos
          </p>

          {blocksLoading ? (
            <Loader2 size={14} className="animate-spin text-muted-foreground" />
          ) : blocks.length === 0 && !showAddBlock ? (
            <p className="text-[11px] text-muted-foreground">Sin bloqueos</p>
          ) : (
            <div className="space-y-1">
              {blocks.map((b: CourtBlock) => (
                <div
                  key={b.id}
                  className="flex items-center gap-2 px-2 py-1 rounded bg-secondary/60 text-[11px] group/block"
                >
                  <CalendarOff
                    size={10}
                    className="text-muted-foreground shrink-0"
                  />
                  <span className="flex-1 min-w-0 truncate">
                    {b.startDate === b.endDate
                      ? b.startDate
                      : `${b.startDate} – ${b.endDate}`}
                    {b.startTime && b.endTime && ` · ${b.startTime}–${b.endTime}`}
                    {b.reason && ` · ${b.reason}`}
                  </span>
                  <button
                    onClick={() => setConfirmDeleteBlock(b)}
                    disabled={removeBlock.isPending}
                    className="p-1.5 sm:p-0.5 sm:opacity-0 sm:group-hover/block:opacity-100 rounded hover:bg-destructive/15 text-destructive sm:transition-opacity"
                    title="Eliminar bloqueo"
                  >
                    {removeBlock.isPending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <X size={12} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAddBlock ? (
            <div className="space-y-1.5 pt-1 border-t border-border">
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">
                    Desde *
                  </p>
                  <input
                    type="date"
                    value={blockForm.startDate}
                    onChange={(e) =>
                      setBlockForm((f) => ({ ...f, startDate: e.target.value }))
                    }
                    className="w-full h-7 rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">
                    Hasta
                  </p>
                  <input
                    type="date"
                    value={blockForm.endDate}
                    onChange={(e) =>
                      setBlockForm((f) => ({ ...f, endDate: e.target.value }))
                    }
                    className="w-full h-7 rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">
                    Hora inicio
                  </p>
                  <input
                    type="time"
                    value={blockForm.startTime}
                    onChange={(e) =>
                      setBlockForm((f) => ({ ...f, startTime: e.target.value }))
                    }
                    className="w-full h-7 rounded border border-border bg-background px-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">
                    Hora fin
                  </p>
                  <input
                    type="time"
                    value={blockForm.endTime}
                    onChange={(e) =>
                      setBlockForm((f) => ({ ...f, endTime: e.target.value }))
                    }
                    className="w-full h-7 rounded border border-border bg-background px-2 text-xs focus:outline-none"
                  />
                </div>
              </div>
              <input
                value={blockForm.reason}
                onChange={(e) =>
                  setBlockForm((f) => ({ ...f, reason: e.target.value }))
                }
                placeholder="Motivo (opcional)"
                className="w-full h-7 rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowAddBlock(false);
                    setBlockForm({ ...EMPTY_BLOCK });
                  }}
                  className="px-2 py-1 text-[11px] rounded border border-border text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (!blockForm.startDate) {
                      toast.error("La fecha de inicio es obligatoria");
                      return;
                    }
                    addBlock.mutate();
                  }}
                  disabled={addBlock.isPending}
                  className="px-2 py-1 text-[11px] rounded bg-[#D4AF37] text-[#0C0C0C] font-semibold hover:bg-[#C9A227] disabled:opacity-50 flex items-center gap-1"
                >
                  {addBlock.isPending && (
                    <Loader2 size={10} className="animate-spin" />
                  )}{" "}
                  Añadir
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddBlock(true)}
              className="w-full flex items-center justify-center gap-1 py-1 text-[11px] rounded border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-[#D4AF37]/40 transition-colors"
            >
              <Plus size={10} /> Añadir bloqueo
            </button>
          )}
        </div>
      )}

      <ConfirmModal
        open={confirmDelete}
        title={`Eliminar pista "${court.name}"`}
        description="La pista se desactivará. Si tiene partidos programados en torneos activos no se podrá eliminar."
        confirmLabel="Sí, eliminar"
        danger
        loading={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          remove.mutate();
          setConfirmDelete(false);
        }}
      />

      <ConfirmModal
        open={!!confirmDeleteBlock}
        title="Eliminar bloqueo"
        description={
          confirmDeleteBlock
            ? `Se eliminará el bloqueo del ${
                confirmDeleteBlock.startDate === confirmDeleteBlock.endDate
                  ? confirmDeleteBlock.startDate
                  : `${confirmDeleteBlock.startDate} a ${confirmDeleteBlock.endDate}`
              }${confirmDeleteBlock.reason ? ` (${confirmDeleteBlock.reason})` : ""}.`
            : ""
        }
        confirmLabel="Sí, eliminar"
        danger
        loading={removeBlock.isPending}
        onClose={() => setConfirmDeleteBlock(null)}
        onConfirm={() => {
          if (confirmDeleteBlock) removeBlock.mutate(confirmDeleteBlock.id);
          setConfirmDeleteBlock(null);
        }}
      />
    </div>
  );
}

interface CourtsManagerProps {
  clubId: string;
}

/**
 * UI inline de gestión de pistas + bloqueos de un club. Sirve tanto a ADMIN
 * (embebido en el modal de /clubes) como a CLUB (embebido en /mi-club como
 * card). El backend ya enforce que solo el dueño del club pueda tocar sus
 * pistas (assertClubAccess), así que aquí no hay gating extra.
 */
export function CourtsManager({ clubId }: CourtsManagerProps) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState<CourtForm>({ ...EMPTY_COURT });

  const { data: courts = [], isLoading } = useQuery({
    queryKey: ["admin-courts", clubId],
    queryFn: () => adminService.courts.list(clubId),
  });

  const create = useMutation({
    mutationFn: () =>
      adminService.courts.create(clubId, {
        name: newForm.name.trim(),
        isIndoor: newForm.isIndoor,
        isCentral: newForm.isCentral,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-courts", clubId] });
      setNewForm({ ...EMPTY_COURT });
      setShowAdd(false);
      toast.success("Pista creada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({
      courtId,
      direction,
    }: {
      courtId: string;
      direction: "up" | "down";
    }) => {
      const idx = courts.findIndex((c) => c.id === courtId);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= courts.length) return;
      const reordered = [...courts];
      [reordered[idx], reordered[swapIdx]] = [
        reordered[swapIdx],
        reordered[idx],
      ];
      await Promise.all(
        reordered.map((c, i) =>
          adminService.courts.update(clubId, c.id, { order: i }),
        ),
      );
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-courts", clubId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!newForm.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    create.mutate();
  };

  return (
    <div className="space-y-2">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : courts.length === 0 && !showAdd ? (
        <div className="text-center py-8 space-y-2">
          <LayoutGrid size={28} className="mx-auto text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No hay pistas registradas.
          </p>
        </div>
      ) : (
        courts.map((c, idx) => (
          <CourtRow
            key={c.id}
            court={c}
            clubId={clubId}
            canMoveUp={idx > 0}
            canMoveDown={idx < courts.length - 1}
            onMoveUp={() => move.mutate({ courtId: c.id, direction: "up" })}
            onMoveDown={() => move.mutate({ courtId: c.id, direction: "down" })}
          />
        ))
      )}

      {showAdd && (
        <div className="border border-[#D4AF37]/40 rounded-lg p-3 space-y-2 bg-[rgba(212,175,55,0.04)]">
          <p className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wide">
            Nueva pista
          </p>
          <input
            value={newForm.name}
            onChange={(e) =>
              setNewForm((f) => ({ ...f, name: e.target.value }))
            }
            placeholder="Nombre *"
            className="w-full h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          />
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={newForm.isIndoor}
                onChange={(e) =>
                  setNewForm((f) => ({ ...f, isIndoor: e.target.checked }))
                }
                className="accent-[#D4AF37]"
              />
              Cubierta
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={newForm.isCentral}
                onChange={(e) =>
                  setNewForm((f) => ({ ...f, isCentral: e.target.checked }))
                }
                className="accent-[#D4AF37]"
              />
              Pista Central
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => {
                setShowAdd(false);
                setNewForm({ ...EMPTY_COURT });
              }}
              className="px-3 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={create.isPending}
              className="px-3 py-1 text-xs rounded bg-[#D4AF37] text-[#0C0C0C] font-semibold hover:bg-[#C9A227] disabled:opacity-50 flex items-center gap-1"
            >
              {create.isPending && (
                <Loader2 size={11} className="animate-spin" />
              )}{" "}
              Crear
            </button>
          </div>
        </div>
      )}

      {!showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-[#D4AF37]/50 transition-colors"
        >
          <Plus size={14} /> Añadir pista
        </button>
      )}
    </div>
  );
}
