"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  createTicketId,
  formatTimestamp,
  migrateTicket,
  normalizeTicketNumber,
  normalizeText,
  type SortKey,
  type Ticket,
  type TicketStatus,
  statusLabel,
  STATUS_ORDER,
} from "@/lib/tickets";

const STORAGE_KEY = "valet-dashboard-tickets";
const FALLBACK_STORAGE_KEY = "valet-tracker-tickets";
const OUTLET_OPTIONS = ["ON", "HE", "FS", "BF", "HF"] as const;

type ModalMode = "add" | "edit";
type FilterValue = "all" | TicketStatus;

function loadStoredTickets() {
  if (typeof window === "undefined") return [];

  const keys = [STORAGE_KEY, FALLBACK_STORAGE_KEY];
  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (item && typeof item === "object" ? migrateTicket(item) : null))
          .filter((item): item is Ticket => Boolean(item));
      }
    } catch {
      // Ignore malformed local data and fall back to an empty board.
    }
  }

  return [];
}

function sortLabel(key: SortKey) {
  switch (key) {
    case "status":
      return "Status";
    case "outlet":
      return "Outlet";
    case "parkedBy":
      return "Parked By";
    case "updatedAt":
      return "Last Updated";
    case "number":
    default:
      return "Ticket #";
  }
}

function compareTickets(a: Ticket, b: Ticket, sortKey: SortKey, direction: "asc" | "desc") {
  let result = 0;

  switch (sortKey) {
    case "number":
      result = a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" });
      break;
    case "status":
      result = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      if (result === 0) {
        result = a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" });
      }
      break;
    case "outlet":
      result = a.outlet.localeCompare(b.outlet, undefined, { numeric: true, sensitivity: "base" });
      break;
    case "parkedBy":
      result = a.parkedBy.localeCompare(b.parkedBy, undefined, { numeric: true, sensitivity: "base" });
      break;
    case "updatedAt":
      result = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      break;
  }

  return direction === "asc" ? result : -result;
}

export function Dashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all");
  const [sortKey, setSortKey] = useState<SortKey>("number");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [modalMode, setModalMode] = useState<ModalMode>("add");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [editSearch, setEditSearch] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "success" | "error">("info");
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ number: "", outlet: "ON", parkedBy: "" });

  useEffect(() => {
    setTickets(loadStoredTickets());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  }, [tickets, hydrated]);

  const sortedTickets = useMemo(
    () => [...tickets].sort((a, b) => compareTickets(a, b, sortKey, sortDirection)),
    [tickets, sortDirection, sortKey]
  );

  const visibleTickets = useMemo(
    () => (activeFilter === "all" ? sortedTickets : sortedTickets.filter((ticket) => ticket.status === activeFilter)),
    [activeFilter, sortedTickets]
  );

  const groupedTickets = useMemo(() => {
    return {
      parked: sortedTickets.filter((ticket) => ticket.status === "parked"),
      transit: sortedTickets.filter((ticket) => ticket.status === "transit"),
      completed: sortedTickets.filter((ticket) => ticket.status === "completed"),
    };
  }, [sortedTickets]);

  useEffect(() => {
    if (!modalOpen || modalMode !== "edit") return;

    if (!selectedTicketId && sortedTickets.length > 0) {
      setSelectedTicketId(sortedTickets[0].id);
    }
  }, [modalMode, modalOpen, selectedTicketId, sortedTickets]);

  useEffect(() => {
    if (!modalOpen || modalMode !== "edit" || !selectedTicketId) return;
    const ticket = tickets.find((item) => item.id === selectedTicketId);
    if (!ticket) return;
    setForm({
      number: ticket.number,
      outlet: ticket.outlet || "ON",
      parkedBy: ticket.parkedBy,
    });
  }, [modalMode, modalOpen, selectedTicketId, tickets]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [message]);

  function flash(text: string, tone: "info" | "success" | "error" = "info") {
    setMessage(text);
    setMessageTone(tone);
  }

  function persist(nextTickets: Ticket[]) {
    setTickets(nextTickets);
  }

  function openAddModal() {
    setModalMode("add");
    setSelectedTicketId(null);
    setEditSearch("");
    setFormError("");
    setForm({ number: "", outlet: "ON", parkedBy: "" });
    setModalOpen(true);
  }

  function openEditModal() {
    setModalMode("edit");
    setEditSearch("");
    setFormError("");
    setSelectedTicketId(sortedTickets[0]?.id ?? null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditSearch("");
    setFormError("");
    setSelectedTicketId(null);
  }

  function openTicket(ticketId: string) {
    setModalMode("edit");
    setFormError("");
    setSelectedTicketId(ticketId);
    setModalOpen(true);
  }

  function setTicketStatus(ticketId: string, status: TicketStatus) {
    const next = tickets.map((ticket) =>
      ticket.id === ticketId ? { ...ticket, status, updatedAt: new Date().toISOString() } : ticket
    );
    persist(next);
    flash(`Ticket moved to ${statusLabel(status)}.`, "success");
  }

  function deleteTicket(ticketId: string) {
    const ticket = tickets.find((item) => item.id === ticketId);
    if (!ticket || !window.confirm(`Delete ticket ${ticket.number}?`)) return;

    persist(tickets.filter((item) => item.id !== ticketId));
    flash(`Ticket ${ticket.number} deleted.`, "success");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const number = normalizeTicketNumber(form.number);
    const outlet = normalizeText(form.outlet);
    const parkedBy = normalizeText(form.parkedBy);

    if (!number) {
      setFormError("Ticket number is required.");
      flash("Enter a ticket number before saving.", "error");
      return;
    }

    if (!/^\d+$/.test(number)) {
      setFormError("Ticket number can only contain digits.");
      flash("Ticket number can only contain digits.", "error");
      return;
    }

    setFormError("");

    if (modalMode === "add") {
      if (tickets.some((ticket) => ticket.number === number)) {
        setFormError(`Ticket ${number} already exists.`);
        flash(`Ticket ${number} already exists.`, "error");
        return;
      }

      const nextTicket: Ticket = {
        id: createTicketId(),
        number,
        outlet,
        parkedBy,
        status: "parked",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      persist([nextTicket, ...tickets]);
      flash(`Ticket ${number} added.`, "success");
      closeModal();
      return;
    }

    if (!selectedTicketId) {
      flash("Select a car to edit first.", "error");
      return;
    }

    if (tickets.some((ticket) => ticket.id !== selectedTicketId && ticket.number === number)) {
      setFormError(`Ticket ${number} already exists.`);
      flash(`Ticket ${number} already exists.`, "error");
      return;
    }

    const next = tickets.map((ticket) =>
      ticket.id === selectedTicketId
        ? { ...ticket, number, outlet, parkedBy, updatedAt: new Date().toISOString() }
        : ticket
    );

    persist(next);
    flash(`Ticket ${number} updated.`, "success");
    closeModal();
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((value) => (value === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  function filteredPickerTickets() {
    const query = editSearch.trim().toLowerCase();
    if (!query) return sortedTickets;
    return sortedTickets.filter((ticket) => {
      const haystack = `${ticket.number} ${ticket.outlet} ${ticket.parkedBy} ${statusLabel(ticket.status)}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  function renderActions(ticket: Ticket) {
    return (
      <div className="action-group" onClick={(event) => event.stopPropagation()}>
        {ticket.status === "parked" ? (
          <button className="mini-button primary" type="button" onClick={() => setTicketStatus(ticket.id, "transit")}>
            Send to transit
          </button>
        ) : null}

        {ticket.status === "transit" ? (
          <>
            <button className="mini-button" type="button" onClick={() => setTicketStatus(ticket.id, "parked")}>
              Back to parked
            </button>
            <button className="mini-button success" type="button" onClick={() => setTicketStatus(ticket.id, "completed")}>
              Mark completed
            </button>
          </>
        ) : null}

      </div>
    );
  }

  function ticketRow(ticket: Ticket) {
    return (
      <tr key={ticket.id} className="ticket-row" onClick={() => openTicket(ticket.id)}>
        <td>
          <span className="ticket-number">{ticket.number}</span>
        </td>
        <td>{ticket.outlet || "-"}</td>
        <td>{ticket.parkedBy || "-"}</td>
        <td>
          <div className="row-stack">
            <span>{formatTimestamp(ticket.updatedAt)}</span>
            {renderActions(ticket)}
          </div>
        </td>
        <td className="table-actions-cell" onClick={(event) => event.stopPropagation()}>
          <button
            className="delete-button"
            type="button"
            onClick={() => deleteTicket(ticket.id)}
            aria-label={`Delete ticket ${ticket.number}`}
          >
            <img src="/valet-stand/icons/trash-bin-svgrepo-com.svg" alt="" aria-hidden="true" />
          </button>
        </td>
      </tr>
    );
  }

  function table() {
    const rows = visibleTickets.map(ticketRow);

    return (
      <div className="table-wrap">
        <table className="ticket-table">
          <thead>
            <tr>
              <th>
                <button className="sortable" type="button" onClick={() => toggleSort("number")}>
                  Ticket # <span className="sort-arrow">{sortKey === "number" ? (sortDirection === "asc" ? "^" : "v") : ""}</span>
                </button>
              </th>
              <th>
                <button className="sortable" type="button" onClick={() => toggleSort("outlet")}>
                  Outlet <span className="sort-arrow">{sortKey === "outlet" ? (sortDirection === "asc" ? "^" : "v") : ""}</span>
                </button>
              </th>
              <th>
                <button className="sortable" type="button" onClick={() => toggleSort("parkedBy")}>
                  Parked By <span className="sort-arrow">{sortKey === "parkedBy" ? (sortDirection === "asc" ? "^" : "v") : ""}</span>
                </button>
              </th>
              <th>
                <button className="sortable" type="button" onClick={() => toggleSort("updatedAt")}>
                  Last Updated <span className="sort-arrow">{sortKey === "updatedAt" ? (sortDirection === "asc" ? "^" : "v") : ""}</span>
                </button>
              </th>
              <th className="table-actions-heading"></th>
            </tr>
          </thead>
          <tbody>{rows.length > 0 ? rows : <tr><td colSpan={5}><div className="empty-state">No tickets in this view.</div></td></tr>}</tbody>
        </table>
      </div>
    );
  }

  function groupedBoard() {
    const sections: Array<{ key: TicketStatus; label: string; tickets: Ticket[] }> = [
      { key: "parked", label: "Parked", tickets: groupedTickets.parked },
      { key: "transit", label: "In transit", tickets: groupedTickets.transit },
      { key: "completed", label: "Completed", tickets: groupedTickets.completed },
    ];

    return (
      <>
        {sections.map((section) => (
          <details className="status-group" key={section.key} open>
            <summary>
              <div className="summary-left">
                <span className="chevron" aria-hidden="true" />
                <div className="group-title">
                  <strong>{section.label}</strong>
                </div>
              </div>
              <span className="count-pill">
                {section.tickets.length} ticket{section.tickets.length === 1 ? "" : "s"}
              </span>
            </summary>

            {section.tickets.length === 0 ? (
              <div className="empty-state">No {section.label.toLowerCase()} tickets yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="ticket-table">
                  <thead>
                    <tr>
                      <th>
                        <button className="sortable" type="button" onClick={() => toggleSort("number")}>
                          Ticket # <span className="sort-arrow">{sortKey === "number" ? (sortDirection === "asc" ? "^" : "v") : ""}</span>
                        </button>
                      </th>
                      <th>
                        <button className="sortable" type="button" onClick={() => toggleSort("outlet")}>
                          Outlet <span className="sort-arrow">{sortKey === "outlet" ? (sortDirection === "asc" ? "^" : "v") : ""}</span>
                        </button>
                      </th>
                      <th>
                        <button className="sortable" type="button" onClick={() => toggleSort("parkedBy")}>
                          Parked By <span className="sort-arrow">{sortKey === "parkedBy" ? (sortDirection === "asc" ? "^" : "v") : ""}</span>
                        </button>
                      </th>
                      <th>
                        <button className="sortable" type="button" onClick={() => toggleSort("updatedAt")}>
                          Last Updated <span className="sort-arrow">{sortKey === "updatedAt" ? (sortDirection === "asc" ? "^" : "v") : ""}</span>
                        </button>
                      </th>
                      <th className="table-actions-heading"></th>
                    </tr>
                  </thead>
                  <tbody>{section.tickets.map(ticketRow)}</tbody>
                </table>
              </div>
            )}
          </details>
        ))}
      </>
    );
  }

  const pickerTickets = filteredPickerTickets();
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId);

  return (
    <section className="dashboard">
      <section className="topbar" aria-label="dashboard summary">
        <div className="summary">
          <div className="summary-label">Ticket count</div>
          <div className="summary-value">{tickets.length}</div>
        </div>

        <div className="primary-actions">
          <button className="action-button primary" type="button" onClick={openAddModal}>
            Add Car
          </button>
          <button className="action-button secondary" type="button" onClick={openEditModal}>
            Edit Current Car
          </button>
        </div>
      </section>

      <div className="toolbar" aria-label="table controls">
        <div className="filters" role="tablist" aria-label="status filters">
          {(["all", "parked", "transit", "completed"] as FilterValue[]).map((filter) => (
            <button
              key={filter}
              className={`filter-button ${activeFilter === filter ? "active" : ""}`}
              type="button"
              onClick={() => setActiveFilter(filter)}
            >
              {filter === "all" ? "All" : statusLabel(filter)}
            </button>
          ))}
        </div>
      </div>

      <p className={`message ${messageTone}`} aria-live="polite">
        {message}
      </p>

      <section className="board" aria-label="car list">
        {activeFilter === "all" ? groupedBoard() : table()}
      </section>

      {modalOpen ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" onClick={closeModal}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 id="modalTitle">{modalMode === "add" ? "Add Car" : "Edit Current Car"}</h2>
              <button className="delete-button" type="button" onClick={closeModal} aria-label="Close modal">
                <img src="/valet-stand/icons/x-icon.svg" alt="" aria-hidden="true" />
              </button>
            </div>

            <div className="modal-body">
              <section className="modal-section">
                <form className="form-grid" onSubmit={handleSubmit}>
                  <div className="field">
                    <label htmlFor="ticketNumber">Ticket number *</label>
                    <input
                      id="ticketNumber"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-required="true"
                      value={form.number}
                      onChange={(event) => {
                        setForm((current) => ({ ...current, number: event.target.value.replace(/\D/g, "") }));
                        setFormError("");
                      }}
                      aria-invalid={Boolean(formError)}
                      aria-describedby={formError ? "ticketNumberError" : undefined}
                      placeholder="Required"
                      autoComplete="off"
                    />
                    {formError ? <div className="form-error" id="ticketNumberError">{formError}</div> : null}
                  </div>
                  <div className="field">
                    <label htmlFor="outlet">Outlet</label>
                    <select
                      id="outlet"
                      value={form.outlet}
                      onChange={(event) => setForm((current) => ({ ...current, outlet: event.target.value }))}
                    >
                      {OUTLET_OPTIONS.map((outlet) => (
                        <option key={outlet} value={outlet}>
                          {outlet}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="parkedBy">Parked By</label>
                    <input
                      id="parkedBy"
                      value={form.parkedBy}
                      onChange={(event) => setForm((current) => ({ ...current, parkedBy: event.target.value }))}
                      placeholder="Associate name"
                      autoComplete="off"
                    />
                  </div>

                  <div className="modal-footer">
                    <button className="footer-button secondary" type="button" onClick={closeModal}>
                      Cancel
                    </button>
                    {modalMode === "edit" && selectedTicket?.status === "parked" ? (
                      <button
                        className="footer-button transit"
                        type="button"
                        onClick={() => setTicketStatus(selectedTicket.id, "transit")}
                      >
                        Send to transit
                      </button>
                    ) : null}
                    <button className="footer-button primary" type="submit">
                      {modalMode === "add" ? "Save Car" : "Update Car"}
                    </button>
                  </div>
                </form>
              </section>

              {modalMode === "edit" ? (
                <section className="modal-section">
                  <div className="section-title">Find current car</div>
                  <input
                    className="list-search"
                    value={editSearch}
                    onChange={(event) => setEditSearch(event.target.value)}
                    type="text"
                    placeholder="Search by ticket number, outlet, or parked by"
                    autoComplete="off"
                  />

                  <div className="ticket-picker">
                    {pickerTickets.length === 0 ? (
                      <div className="empty-state">
                        {tickets.length === 0
                          ? "No cars yet. Add one first, then you can edit it here."
                          : "No cars match that search."}
                      </div>
                    ) : (
                      pickerTickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          className={`ticket-choice ${selectedTicketId === ticket.id ? "active" : ""}`}
                          type="button"
                          onClick={() => {
                            setSelectedTicketId(ticket.id);
                            setFormError("");
                            setForm({ number: ticket.number, outlet: ticket.outlet || "ON", parkedBy: ticket.parkedBy });
                            flash(`Editing ticket ${ticket.number}.`, "success");
                          }}
                        >
                          <strong>{ticket.number}</strong>
                          <span>
                            {statusLabel(ticket.status)}
                            {ticket.outlet ? ` | ${ticket.outlet}` : ""}
                            {ticket.parkedBy ? ` | ${ticket.parkedBy}` : ""}
                          </span>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="form-note">Select a car to load it into the form on the left.</div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
