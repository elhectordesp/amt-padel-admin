"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Search, Plus, UserPlus, AlertTriangle, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { adminService } from "@/lib/services/admin";
import { CATEGORY_LABEL_SHORT as LEVEL_LABEL, LEVELS } from "@/lib/constants";
import type { Player, Tournament, AdminEnrollTeamPayload, CategoryLevel, CreatePlayerPayload } from "@/types";

interface Props {
  tournament: Tournament;
  onClose: () => void;
  /** Llamado tras inscripción exitosa con el ID de la primera inscripción */
  onEnrolled?: (registrationId: string) => void;
}

interface PlayerSlot {
  player: Player | null;
  searching: boolean;
  query: string;
  results: Player[];
  creating: boolean;
  createForm: Partial<CreatePlayerPayload>;
  createErrors: Record<string, string>;
}

const emptySlot = (): PlayerSlot => ({
  player: null, searching: false, query: "", results: [],
  creating: false, createForm: {}, createErrors: {},
});

const emptyCreateForm = (): Partial<CreatePlayerPayload> => ({
  firstName: "", lastName: "", gender: undefined,
  email: "", phone: "", categoryLevel: undefined,
});

// ── Module-level utilities ────────────────────────────────────────────────────

async function searchPlayers(q: string, setSlot: (fn: (s: PlayerSlot) => PlayerSlot) => void) {
  if (q.length < 2) { setSlot((s) => ({ ...s, results: [], searching: false })); return; }
  setSlot((s) => ({ ...s, searching: true }));
  try {
    const res = await adminService.players.list({ q, pageSize: 8 });
    setSlot((s) => ({ ...s, results: res.data, searching: false }));
  } catch {
    setSlot((s) => ({ ...s, results: [], searching: false }));
  }
}

function handleQueryChange(
  val: string,
  setSlot: (fn: (s: PlayerSlot) => PlayerSlot) => void,
  debounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | undefined>,
) {
  setSlot((s) => ({ ...s, query: val, player: null }));
  clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => searchPlayers(val, setSlot), 300);
}

function selectPlayer(player: Player, setSlot: (fn: (s: PlayerSlot) => PlayerSlot) => void) {
  setSlot((s) => ({ ...s, player, query: player.name, results: [], creating: false }));
}

function validateCreateForm(form: Partial<CreatePlayerPayload>): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!form.firstName?.trim()) errs.firstName = "Obligatorio";
  if (!form.lastName?.trim())  errs.lastName  = "Obligatorio";
  if (!form.gender)            errs.gender    = "Obligatorio";
  return errs;
}

// ── PlayerSlotSection (module-level component) ────────────────────────────────

interface PlayerSlotSectionProps {
  label: string;
  slot: PlayerSlot;
  setSlot: (fn: (s: PlayerSlot) => PlayerSlot) => void;
  debounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | undefined>;
  otherPlayerId?: string | null;
}

function PlayerSlotSection({ label, slot, setSlot, debounceRef, otherPlayerId }: PlayerSlotSectionProps) {
  const qc = useQueryClient();
  const createMut = useMutation({ mutationFn: (d: CreatePlayerPayload) => adminService.players.create(d) });

  const handleCreatePlayer = async () => {
    const errs = validateCreateForm(slot.createForm);
    if (Object.keys(errs).length) { setSlot((s) => ({ ...s, createErrors: errs })); return; }

    const payload: CreatePlayerPayload = {
      firstName:     slot.createForm.firstName!.trim(),
      lastName:      slot.createForm.lastName!.trim(),
      gender:        slot.createForm.gender!,
      email:         slot.createForm.email?.trim() || undefined,
      phone:         slot.createForm.phone?.trim() || undefined,
      categoryLevel: slot.createForm.categoryLevel || undefined,
    };

    try {
      const created = await createMut.mutateAsync(payload);
      const asPlayer: Player = {
        id:    created.id,
        name:  `${payload.firstName} ${payload.lastName}`,
        email: created.email ?? null,
        gender: payload.gender,
        level: (payload.categoryLevel ?? "4a") as Player["level"],
        played: 0, wins: 0, points: 0, trend: "stable",
        managedByAdmin: true,
      };
      setSlot((s) => ({ ...s, player: asPlayer, query: asPlayer.name, creating: false, createErrors: {} }));
      qc.invalidateQueries({ queryKey: ["admin", "players"] });
    } catch {
      toast.error("No se pudo crear el jugador");
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>

      {!slot.creating ? (
        <div className="relative">
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={slot.query}
              onChange={(e) => handleQueryChange(e.target.value, setSlot, debounceRef)}
              placeholder="Buscar por nombre, email o teléfono…"
              className="w-full h-9 pl-9 pr-9 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
            />
            {slot.player && (
              <button
                onClick={() => setSlot((s) => ({ ...s, player: null, query: "", results: [] }))}
                className="absolute right-2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Search results dropdown */}
          {!slot.player && (slot.results.length > 0 || slot.searching) && (
            <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-md shadow-xl overflow-hidden">
              {slot.searching && (
                <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground text-sm">
                  <Loader2 size={12} className="animate-spin" /> Buscando…
                </div>
              )}
              {slot.results
                .filter((p) => p.id !== otherPlayerId)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPlayer(p, setSlot)}
                    className="w-full text-left px-3 py-2 hover:bg-secondary flex items-center gap-3 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-[rgba(212,175,55,0.15)] border border-[rgba(212,175,55,0.3)] flex items-center justify-center text-xs font-bold text-[#D4AF37] shrink-0">
                      {p.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.gender} · {LEVEL_LABEL[p.level] ?? p.level}
                        {p.email ? ` · ${p.email}` : ""}
                      </p>
                    </div>
                  </button>
                ))}
              {!slot.searching && slot.results.filter((p) => p.id !== otherPlayerId).length === 0 && slot.query.length >= 2 && (
                <div className="px-3 py-2 text-muted-foreground text-sm">Sin resultados</div>
              )}
            </div>
          )}

          {/* Selected player badge */}
          {slot.player && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-md bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.3)]">
              <Check size={14} className="text-[#D4AF37] shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-foreground font-medium truncate">{slot.player.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {slot.player.gender} · {LEVEL_LABEL[slot.player.level] ?? slot.player.level}
                  {slot.player.email ? ` · ${slot.player.email}` : ""}
                  {slot.player.managedByAdmin && " · creado por admin"}
                </p>
              </div>
            </div>
          )}

          {/* Create new player link */}
          {!slot.player && (
            <button
              onClick={() => setSlot((s) => ({ ...s, creating: true, query: "", results: [], createForm: emptyCreateForm(), createErrors: {} }))}
              className="mt-2 flex items-center gap-1.5 text-xs text-[#D4AF37] hover:underline"
            >
              <Plus size={12} /> Crear nuevo jugador
            </button>
          )}
        </div>
      ) : (
        /* ── Inline create form ── */
        <div className="bg-secondary/60 border border-border rounded-md p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[#D4AF37] flex items-center gap-1.5 uppercase tracking-wide">
              <UserPlus size={12} /> Nuevo jugador
            </p>
            <button onClick={() => setSlot((s) => ({ ...s, creating: false, createErrors: {} }))} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(["firstName", "lastName"] as const).map((field) => (
              <div key={field}>
                <input
                  type="text"
                  placeholder={field === "firstName" ? "Nombre *" : "Apellidos *"}
                  value={(slot.createForm[field] as string) ?? ""}
                  onChange={(e) => setSlot((s) => ({ ...s, createForm: { ...s.createForm, [field]: e.target.value }, createErrors: { ...s.createErrors, [field]: "" } }))}
                  className="w-full h-8 px-3 rounded-md bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
                />
                {slot.createErrors[field] && <p className="text-destructive text-xs mt-0.5">{slot.createErrors[field]}</p>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <select
                value={slot.createForm.gender ?? ""}
                onChange={(e) => setSlot((s) => ({ ...s, createForm: { ...s.createForm, gender: e.target.value as "M" | "F" }, createErrors: { ...s.createErrors, gender: "" } }))}
                className="w-full h-8 px-2 rounded-md bg-card border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
              >
                <option value="">Género *</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
              {slot.createErrors.gender && <p className="text-destructive text-xs mt-0.5">{slot.createErrors.gender}</p>}
            </div>
            <select
              value={slot.createForm.categoryLevel ?? ""}
              onChange={(e) => setSlot((s) => ({ ...s, createForm: { ...s.createForm, categoryLevel: (e.target.value || undefined) as CategoryLevel | undefined } }))}
              className="w-full h-8 px-2 rounded-md bg-card border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
            >
              <option value="">Nivel (opc.)</option>
              {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
            </select>
            <input
              type="tel"
              placeholder="Teléfono"
              value={slot.createForm.phone ?? ""}
              onChange={(e) => setSlot((s) => ({ ...s, createForm: { ...s.createForm, phone: e.target.value } }))}
              className="w-full h-8 px-2 rounded-md bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
            />
          </div>

          <input
            type="email"
            placeholder="Email (opcional — se enviará invitación para activar cuenta)"
            value={slot.createForm.email ?? ""}
            onChange={(e) => setSlot((s) => ({ ...s, createForm: { ...s.createForm, email: e.target.value } }))}
            className="w-full h-8 px-3 rounded-md bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
          />

          <button
            onClick={handleCreatePlayer}
            disabled={createMut.isPending}
            className="w-full py-1.5 bg-[#D4AF37] hover:bg-[#C49F2A] disabled:opacity-50 text-[#0C0C0C] text-sm font-semibold rounded-md flex items-center justify-center gap-2 transition-colors"
          >
            {createMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Crear y seleccionar
          </button>
        </div>
      )}
    </div>
  );
}

// ── EnrollTeamModal ───────────────────────────────────────────────────────────

export function EnrollTeamModal({ tournament, onClose, onEnrolled }: Props) {
  const qc = useQueryClient();

  const [slot1, setSlot1] = useState<PlayerSlot>({ ...emptySlot(), createForm: emptyCreateForm() });
  const [slot2, setSlot2] = useState<PlayerSlot>({ ...emptySlot(), createForm: emptyCreateForm() });
  const [noPartner,   setNoPartner]   = useState(false);
  const [categoryId,  setCategoryId]  = useState(tournament.categories?.[0]?.id ?? "");
  const [status,      setStatus]      = useState<"PENDING" | "CONFIRMED">("PENDING");
  const [paid,        setPaid]        = useState(false);
  const [forceEnroll, setForceEnroll] = useState(false);

  const searchDebounce1 = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchDebounce2 = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const selectedCategory = tournament.categories?.find((c) => c.id === categoryId);
  const isNotOpen = !["OPEN", "DRAW", "SCHEDULED"].includes(tournament.status ?? "");

  const enrollMut = useMutation({
    mutationFn: (data: AdminEnrollTeamPayload) =>
      adminService.registrations.enroll(tournament.id, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin", "registrations", tournament.id] });
      const hasSchedule = (tournament.schedule?.length ?? 0) > 0;
      const regId = res.registration1.id;
      const action = hasSchedule && onEnrolled
        ? { label: "Disponibilidad →", onClick: () => onEnrolled(regId) }
        : undefined;

      if (res.movedToWaitlist) {
        toast.warning("La categoría estaba llena. La pareja ha sido añadida a la lista de espera.", { action });
      } else {
        toast.success("Pareja inscrita correctamente.", { action });
      }
      onClose();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const msg = err?.response?.data?.message ?? "Error al inscribir la pareja";
      toast.error(msg);
    },
  });

  const handleSubmit = () => {
    if (!slot1.player) { toast.error("Selecciona o crea el jugador 1"); return; }
    if (!noPartner && !slot2.player) { toast.error("Selecciona o crea el jugador 2, o marca 'Sin pareja'"); return; }
    if (!categoryId) { toast.error("Selecciona una categoría"); return; }

    enrollMut.mutate({
      categoryId,
      player1Id:  slot1.player.id,
      player2Id:  noPartner ? undefined : slot2.player?.id,
      noPartner:  noPartner || undefined,
      status,
      paid,
      forceEnroll: forceEnroll || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="font-heading text-lg text-foreground">Inscribir pareja</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{tournament.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Warning if tournament not open */}
          {isNotOpen && (
            <div className="flex items-start gap-2 bg-yellow-400/10 border border-yellow-400/30 rounded-md px-3 py-2.5">
              <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-400">
                El torneo está en estado <strong>{tournament.status}</strong> (no OPEN). La inscripción se creará igualmente.
              </p>
            </div>
          )}

          {/* Category selector */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">
              Categoría
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
            >
              <option value="">Selecciona categoría…</option>
              {(tournament.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.gender === "M" ? "Masculina" : c.gender === "F" ? "Femenina" : "Mixta"} · {LEVEL_LABEL[c.level] ?? c.level}
                  {" "}({c.registeredCount ?? 0}/{c.totalSpots} plazas)
                </option>
              ))}
            </select>
          </div>

          {/* Player 1 */}
          <PlayerSlotSection
            label="Jugador 1"
            slot={slot1}
            setSlot={setSlot1}
            debounceRef={searchDebounce1}
            otherPlayerId={slot2.player?.id}
          />

          {/* No partner toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={noPartner}
              onChange={(e) => { setNoPartner(e.target.checked); if (e.target.checked) setSlot2(emptySlot()); }}
              className="w-4 h-4 rounded border-border bg-secondary accent-[#D4AF37]"
            />
            <span className="text-sm text-foreground">Sin pareja (inscripción individual)</span>
          </label>

          {/* Player 2 */}
          {!noPartner && (
            <PlayerSlotSection
              label="Jugador 2"
              slot={slot2}
              setSlot={setSlot2}
              debounceRef={searchDebounce2}
              otherPlayerId={slot1.player?.id}
            />
          )}

          {/* Options */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">
                Estado inicial
              </label>
              <div className="flex rounded-md overflow-hidden border border-border">
                {(["PENDING", "CONFIRMED"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                      status === s
                        ? s === "CONFIRMED"
                          ? "bg-green-400/20 text-green-400"
                          : "bg-yellow-400/20 text-yellow-400"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s === "PENDING" ? "Pendiente" : "Confirmada"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none mt-5">
                <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-secondary accent-[#D4AF37]" />
                <span className="text-sm text-foreground">Pago recibido</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={forceEnroll} onChange={(e) => setForceEnroll(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-secondary accent-[#D4AF37]" />
                <span className="text-sm text-foreground">Forzar (ignorar límite de plazas)</span>
              </label>
            </div>
          </div>

          {/* Spot indicator */}
          {selectedCategory && (
            <p className="text-xs text-muted-foreground">
              Plazas ocupadas: {selectedCategory.registeredCount ?? "?"} / {selectedCategory.totalSpots}
              {(selectedCategory.registeredCount ?? 0) >= selectedCategory.totalSpots && !forceEnroll
                ? " — la inscripción irá a lista de espera"
                : ""}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={enrollMut.isPending}
            className="flex items-center gap-2 px-5 py-2 rounded-md bg-[#D4AF37] hover:bg-[#C49F2A] disabled:opacity-50 text-[#0C0C0C] text-sm font-semibold transition-colors"
          >
            {enrollMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Inscribir pareja
          </button>
        </div>
      </div>
    </div>
  );
}
