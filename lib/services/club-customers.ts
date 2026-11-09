import { api } from "@/lib/api";

/**
 * Clientes del club: quien reserva o juega en el club, tenga o no la app.
 * Con cuenta, nombre y contacto vienen de la cuenta (el club no los edita).
 */

export type ClubCustomerSource = "BOOKING" | "REGISTRATION" | "MANUAL";

export interface ClubCustomer {
  id:           string;
  clubId:       string;
  userId:       string | null;
  hasAccount:   boolean;
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
  createdAt:    string;
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

export interface CreateClubCustomerPayload {
  /** Con cuenta AMT: nada más (el contacto sale de la cuenta). */
  userId?: string;
  name?:   string;
  phone?:  string;
  email?:  string;
}

export interface UpdateClubCustomerPayload {
  name?:         string;
  phone?:        string | null;
  email?:        string | null;
  notes?:        string | null;
  tags?:         string[];
  isMember?:     boolean;
  memberNumber?: string | null;
  memberSince?:  string | null;
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
  archive: (clubId: string, id: string) =>
    api.post<ClubCustomer>(`${base(clubId)}/${id}/archive`).then((r) => r.data),
  unarchive: (clubId: string, id: string) =>
    api.post<ClubCustomer>(`${base(clubId)}/${id}/unarchive`).then((r) => r.data),
};
