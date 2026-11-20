"use client";

import {
  CLUB_STAFF_ROLES, ROLE_DESCRIPTION, ROLE_LABEL, type ClubStaffRole,
} from "@/lib/club-permissions";

/** Casillas de roles, cada una con una línea que explica qué puede hacer. */
export function StaffRolePicker({
  value, onChange, disabled,
}: {
  value: ClubStaffRole[];
  onChange: (roles: ClubStaffRole[]) => void;
  disabled?: boolean;
}) {
  const toggle = (role: ClubStaffRole) =>
    onChange(value.includes(role) ? value.filter((r) => r !== role) : [...value, role]);

  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
        Roles (se pueden combinar)
      </legend>
      {CLUB_STAFF_ROLES.map((role) => (
        <label
          key={role}
          className="flex items-start gap-3 rounded-md border border-border px-3 py-2.5 min-h-11 cursor-pointer hover:bg-secondary/40 has-[:checked]:border-[#D4AF37]/60 has-[:checked]:bg-[rgba(212,175,55,0.06)]"
        >
          <input
            type="checkbox"
            checked={value.includes(role)}
            onChange={() => toggle(role)}
            className="mt-0.5 size-4 accent-[#D4AF37]"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">{ROLE_LABEL[role]}</span>
            <span className="block text-xs text-muted-foreground">{ROLE_DESCRIPTION[role]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** Los roles de una persona en chips. */
export function RoleChips({ roles }: { roles: ClubStaffRole[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <span
          key={role}
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.08)] text-[#D4AF37] whitespace-nowrap"
        >
          {ROLE_LABEL[role]}
        </span>
      ))}
    </span>
  );
}
