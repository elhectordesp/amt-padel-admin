import { api } from "@/lib/api";

/**
 * Clientes del club: quien reserva o juega en el club, tenga o no la app.
 * Con cuenta, nombre y contacto vienen de la cuenta (el club no los edita).
 */

export type ClubCustomerSource = "BOOKING" | "REGISTRATION" | "MANUAL" | "IMPORT";

export interface ClubCustomer {
  id:           string;
  clubId:       string;
  userId:       string | null;
  hasAccount:   boolean;
  /** Anonimizado a petición (RGPD): sin datos personales y sin edición posible. No viene con un back anterior. */
  anonymized?:  boolean;
  name:         string | null;
  phone:        string | null;
  email:        string | null;
  isMember:     boolean;
  memberNumber: string | null;
  /** AAAA-MM-DD */
  memberSince:  string | null;
  notes:        string | null;
  tags:         string[];
  source:       ClubCustomerSource;
  archivedAt:   string | null;
  /** Cuándo se dio de baja de los mensajes del club (lo hace la persona desde el email; el club no puede quitarlo). */
  messagesOptOutAt?: string | null;
  createdAt:    string;
  // Menores. No vienen con un back anterior: sin ellos, es un adulto.
  /** AAAA-MM-DD */
  birthDate?:         string | null;
  /** Años cumplidos hoy en el reloj del club; null sin fecha de nacimiento. */
  age?:               number | null;
  /** Menos de 18 años. */
  isMinor?:           boolean;
  guardianName?:      string | null;
  guardianPhone?:     string | null;
  guardianEmail?:     string | null;
  /** Cuándo apuntó el club que el tutor consintió; quién, en el historial. */
  guardianConsentAt?: string | null;
  /** Menor de 14: necesita el consentimiento del tutor. */
  guardianConsentRequired?: boolean;
  /** Menor de 14 sin el consentimiento apuntado: no se le escribe. */
  guardianConsentMissing?: boolean;
}

export interface ClubCustomerBooking {
  id:            string;
  shortCode:     string;
  startsAt:      string;
  endsAt:        string;
  status:        string;
  priceCents:    number;
  paidAt:        string | null;
  paymentMethod: string | null;
  court:         { id: string; name: string } | null;
}

export interface ClubCustomerRegistration {
  id:         string;
  status:     string;
  tournament: { id: string; name: string; startDate: string; status: string };
  category:   { id: string; gender: string; level: string };
}

export interface ClubCustomerDetail extends ClubCustomer {
  bookings:      ClubCustomerBooking[];
  registrations: ClubCustomerRegistration[];
}

export interface ClubCustomersQuery {
  q?:        string;
  member?:   "true" | "false";
  tag?:      string;
  archived?: "true" | "false";
  page?:     number;
  pageSize?: number;
}

export interface ClubCustomersPage {
  items:    ClubCustomer[];
  total:    number;
  page:     number;
  pageSize: number;
}

/** Nacimiento y tutor de un menor; null borra el dato al editar. El consentimiento se apunta aparte. */
export interface GuardianPayload {
  /** AAAA-MM-DD, no futura. */
  birthDate?:     string | null;
  guardianName?:  string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
}

export interface CreateClubCustomerPayload extends GuardianPayload {
  /** Con cuenta AMT: nada más (el contacto sale de la cuenta). */
  userId?: string;
  name?:   string;
  phone?:  string;
  email?:  string;
}

export interface UpdateClubCustomerPayload extends GuardianPayload {
  name?:         string;
  phone?:        string | null;
  email?:        string | null;
  notes?:        string | null;
  tags?:         string[];
  isMember?:     boolean;
  memberNumber?: string | null;
  memberSince?:  string | null;
}

/** Informe de la importación de un CSV (la misma forma en la vista previa y al confirmar). */
export interface ClubCustomersImportReport {
  total:      number;
  toCreate:   number;
  created:    number;
  duplicates: { line: number; reason: string }[];
  errors:     { line: number; message: string }[];
}

export const clubCustomersQK = {
  all:    (clubId: string) => ["club-customers", clubId] as const,
  list:   (clubId: string, q: ClubCustomersQuery) => ["club-customers", clubId, "list", q] as const,
  detail: (clubId: string, id: string) => ["club-customers", clubId, "detail", id] as const,
  tags:   (clubId: string) => ["club-customers", clubId, "tags"] as const,
};

const base = (clubId: string) => `/admin/clubs/${clubId}/customers`;

export const clubCustomersService = {
  list: (clubId: string, params: ClubCustomersQuery) =>
    api.get<ClubCustomersPage>(base(clubId), { params }).then((r) => r.data),
  detail: (clubId: string, id: string) =>
    api.get<ClubCustomerDetail>(`${base(clubId)}/${id}`).then((r) => r.data),
  tags: (clubId: string) =>
    api.get<string[]>(`${base(clubId)}/tags`).then((r) => r.data ?? []),
  create: (clubId: string, data: CreateClubCustomerPayload) =>
    api.post<ClubCustomer>(base(clubId), data).then((r) => r.data),
  update: (clubId: string, id: string, data: UpdateClubCustomerPayload) =>
    api.patch<ClubCustomer>(`${base(clubId)}/${id}`, data).then((r) => r.data),
  importCsv: (clubId: string, file: File, dryRun: boolean) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<ClubCustomersImportReport>(`${base(clubId)}/import`, form, {
        params: { dryRun },
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  /** Apunta que el tutor ha consentido (necesita su nombre guardado). */
  markGuardianConsent: (clubId: string, id: string) =>
    api.post<ClubCustomer>(`${base(clubId)}/${id}/guardian-consent`).then((r) => r.data),
  clearGuardianConsent: (clubId: string, id: string) =>
    api.delete<ClubCustomer>(`${base(clubId)}/${id}/guardian-consent`).then((r) => r.data),
  archive: (clubId: string, id: string) =>
    api.post<ClubCustomer>(`${base(clubId)}/${id}/archive`).then((r) => r.data),
  unarchive: (clubId: string, id: string) =>
    api.post<ClubCustomer>(`${base(clubId)}/${id}/unarchive`).then((r) => r.data),
  /** Borra los datos personales del cliente (RGPD). Irreversible; solo propietario y gestor. */
  anonymize: (clubId: string, id: string) =>
    api.post<ClubCustomer>(`${base(clubId)}/${id}/anonymize`).then((r) => r.data),
};
