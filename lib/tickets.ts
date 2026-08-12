export type TicketStatus = "parked" | "transit" | "completed";

export type SortKey = "number" | "status" | "outlet" | "parkedBy" | "updatedAt";

export interface Ticket {
  id: string;
  number: string;
  outlet: string;
  parkedBy: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

export const STATUS_ORDER: Record<TicketStatus, number> = {
  parked: 0,
  transit: 1,
  completed: 2,
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  parked: "Parked",
  transit: "In transit",
  completed: "Completed",
};

export function createTicketId() {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  return `ticket_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeTicketNumber(value: unknown) {
  return normalizeText(value).replace(/\s+/g, " ").toUpperCase();
}

export function statusLabel(status: TicketStatus) {
  return STATUS_LABELS[status] ?? "Parked";
}

export function formatTimestamp(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function normalizeTimestamp(value: unknown) {
  if (!value) return new Date().toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function migrateTicket(raw: Partial<Ticket> & Record<string, unknown> = {}): Ticket | null {
  const number = normalizeTicketNumber(raw.number);
  if (!number) return null;

  const status = raw.status === "parked" || raw.status === "transit" || raw.status === "completed"
    ? raw.status
    : "parked";

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : createTicketId(),
    number,
    outlet: normalizeText(raw.outlet),
    parkedBy: normalizeText(raw.parkedBy),
    status,
    createdAt: normalizeTimestamp(raw.createdAt),
    updatedAt: normalizeTimestamp(raw.updatedAt),
  };
}
