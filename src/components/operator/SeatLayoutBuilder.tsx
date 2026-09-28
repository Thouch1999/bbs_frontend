// O3 — visual seat layout builder. Click an empty cell to add a seat, click a
// seat to select it (then edit number / type / female-only), drag a seat onto
// another cell to move (swap) it; undo/redo; deck tabs. The "passenger view"
// underneath renders the draft through the passenger site's own SeatMap
// component — the saved layout is exactly what that component draws.
import { useEffect, useMemo, useState, type CSSProperties, type DragEvent } from "react";
import { Form } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import { useCreateSeatLayout, useSaveLayoutSeats, useUpdateSeatLayout } from "../../api/operator";
import type { BusType } from "../../types";
import type { SeatInput, SeatLayout } from "../../types/operator";
import {
  MAX_COLUMNS,
  MAX_ROWS,
  asPreviewTripSeats,
  clampToGrid,
  generateSeats,
  gridSizeOf,
  moveSeat,
  positionKey,
  toggleSeatAt,
  validateSeats,
} from "../../utils/seatLayout";
import { SeatLegend } from "../booking/SeatLegend";
import { SeatMap } from "../booking/SeatMap";
import { Card } from "../layout/adminlte";
import { ApiErrorAlert } from "../shared/backoffice";

interface Draft {
  seats: SeatInput[];
  rows: number;
  columns: number;
  decks: number;
}

function draftFrom(layout: SeatLayout | null): Draft {
  const seats: SeatInput[] = (layout?.seats ?? []).map((seat) => ({
    seat_number: seat.seat_number,
    deck: seat.deck,
    row_position: seat.row_position,
    col_position: seat.col_position,
    seat_type: seat.seat_type,
    is_female_only: seat.is_female_only,
  }));
  const size = seats.length ? gridSizeOf(seats) : { rows: 10, columns: 5 };
  return { seats, rows: size.rows, columns: size.columns, decks: layout?.deck_count ?? 1 };
}

interface SeatLayoutBuilderProps {
  layout: SeatLayout | null;
  onSaved: (layout: SeatLayout, message: string) => void;
}

export function SeatLayoutBuilder({ layout, onSaved }: SeatLayoutBuilderProps) {
  const { t } = useTranslation(["operator", "backoffice"]);
  const createLayout = useCreateSeatLayout();
  const updateLayout = useUpdateSeatLayout();
  const saveSeats = useSaveLayoutSeats();
  const [name, setName] = useState(layout?.name ?? "");
  const [busType, setBusType] = useState<BusType>(layout?.bus_type ?? "seated");
  const [history, setHistory] = useState<Draft[]>([draftFrom(layout)]);
  const [cursor, setCursor] = useState(0);
  const [deck, setDeck] = useState(1);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<{ row: number; col: number } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [pattern, setPattern] = useState("AB_CD");

  useEffect(() => {
    setName(layout?.name ?? "");
    setBusType(layout?.bus_type ?? "seated");
    setHistory([draftFrom(layout)]);
    setCursor(0);
    setDeck(1);
    setSelectedKey(null);
    saveSeats.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when a different layout is opened
  }, [layout?.public_id]);

  const draft = history[cursor];
  const readOnly = Boolean(layout?.in_use);
  const problems = validateSeats(draft.seats);
  const selectedSeat = draft.seats.find((s) => positionKey(s.deck, s.row_position, s.col_position) === selectedKey) ?? null;
  const previewSeats = useMemo(() => asPreviewTripSeats(draft.seats), [draft.seats]);

  function commit(next: Draft) {
    setHistory([...history.slice(0, cursor + 1), next].slice(-50));
    setCursor(Math.min(cursor + 1, 49));
  }

  function setGrid(patch: Partial<Pick<Draft, "rows" | "columns" | "decks">>) {
    const next = { ...draft, ...patch };
    next.seats = clampToGrid(draft.seats, { rows: next.rows, columns: next.columns }, next.decks);
    commit(next);
    if (deck > next.decks) setDeck(1);
  }

  function clickCell(row: number, col: number) {
    if (readOnly) return;
    const key = positionKey(deck, row, col);
    const exists = draft.seats.some((s) => positionKey(s.deck, s.row_position, s.col_position) === key);
    if (exists && selectedKey !== key) {
      setSelectedKey(key);
      return;
    }
    commit({ ...draft, seats: toggleSeatAt(draft.seats, deck, row, col) });
    setSelectedKey(exists ? null : key);
  }

  function updateSelected(patch: Partial<SeatInput>) {
    if (!selectedSeat) return;
    commit({ ...draft, seats: draft.seats.map((s) => (s === selectedSeat ? { ...s, ...patch } : s)) });
  }

  function onDrop(event: DragEvent, row: number, col: number) {
    event.preventDefault();
    setDragOver(null);
    if (!dragFrom || readOnly) return;
    commit({ ...draft, seats: moveSeat(draft.seats, { deck, ...dragFrom }, { deck, row, col }) });
    setSelectedKey(positionKey(deck, row, col));
    setDragFrom(null);
  }

  function regenerate() {
    const slots = pattern.replace(/[^A-Za-z_]/g, "").slice(0, MAX_COLUMNS);
    if (!slots) return;
    commit({ seats: generateSeats(draft.rows, slots, draft.decks), rows: draft.rows, columns: slots.length, decks: draft.decks });
    setSelectedKey(null);
  }

  async function save(asNew: boolean) {
    let target = layout;
    const trimmedName = name.trim() || t("operator:fleet.untitled_layout");
    if (asNew || !target) {
      target = await createLayout.mutateAsync({
        name: asNew && layout ? t("operator:fleet.copy_of", { name: trimmedName }) : trimmedName,
        bus_type: busType,
      });
    } else if (target.name !== trimmedName || target.bus_type !== busType) {
      await updateLayout.mutateAsync({ publicId: target.public_id, body: { name: trimmedName, bus_type: busType } });
    }
    const saved = await saveSeats.mutateAsync({ publicId: target.public_id, deckCount: draft.decks, seats: draft.seats });
    onSaved(saved, asNew ? t("operator:fleet.layout_copied") : t("operator:fleet.layout_saved"));
  }

  const busy = createLayout.isPending || updateLayout.isPending || saveSeats.isPending;
  const error = createLayout.error ?? updateLayout.error ?? saveSeats.error;
  const cells = [];
  for (let row = 1; row <= draft.rows; row += 1) {
    for (let col = 1; col <= draft.columns; col += 1) {
      const key = positionKey(deck, row, col);
      const seat = draft.seats.find((s) => positionKey(s.deck, s.row_position, s.col_position) === key);
      const classes = ["bbms-builder-cell"];
      if (seat) classes.push("is-seat");
      if (seat?.seat_type === "vip") classes.push("is-vip");
      if (seat?.is_female_only) classes.push("is-female");
      if (key === selectedKey) classes.push("is-selected");
      if (key === dragOver) classes.push("is-drag-over");
      cells.push(
        <button
          key={key}
          type="button"
          className={classes.join(" ")}
          style={{ gridRow: row, gridColumn: col }}
          draggable={Boolean(seat) && !readOnly}
          onDragStart={() => setDragFrom({ row, col })}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(key);
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(event) => onDrop(event, row, col)}
          onClick={() => clickCell(row, col)}
          aria-label={seat ? t("operator:fleet.seat_cell", { number: seat.seat_number }) : t("operator:fleet.empty_cell", { row, col })}
          aria-pressed={key === selectedKey}
          disabled={readOnly && !seat}
        >
          {seat ? seat.seat_number : "+"}
        </button>
      );
    }
  }

  const seatCount = draft.seats.length;

  return (
    <div className="row">
      <div className="col-xl-8">
        <Card
          title={t("operator:fleet.builder_title")}
          tools={
            <>
              {draft.decks > 1 && (
                <div className="btn-group btn-group-sm" role="group">
                  {[1, 2].map((d) => (
                    <button key={d} type="button" className={`btn btn-outline-primary ${deck === d ? "active" : ""}`} onClick={() => setDeck(d)}>
                      {d === 1 ? t("operator:fleet.deck_lower") : t("operator:fleet.deck_upper")}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={cursor === 0 || readOnly} onClick={() => setCursor(cursor - 1)} title={t("operator:fleet.undo")}>
                <i className="fas fa-undo" aria-hidden="true" />
                <span className="visually-hidden">{t("operator:fleet.undo")}</span>
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={cursor >= history.length - 1 || readOnly} onClick={() => setCursor(cursor + 1)} title={t("operator:fleet.redo")}>
                <i className="fas fa-redo" aria-hidden="true" />
                <span className="visually-hidden">{t("operator:fleet.redo")}</span>
              </button>
            </>
          }
          footer={
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <span className="small text-muted">{t("operator:fleet.seat_count", { count: seatCount })}</span>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-secondary" disabled={busy || problems.length > 0} onClick={() => void save(true)}>
                  {t("operator:fleet.save_as_new")}
                </button>
                <button type="button" className="btn bbms-cta" disabled={busy || readOnly || problems.length > 0} onClick={() => void save(false)}>
                  {busy && <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />}
                  {t("backoffice:actions.save")}
                </button>
              </div>
            </div>
          }
        >
          {readOnly && <div className="alert alert-info py-2 small">{t("operator:fleet.layout_in_use")}</div>}
          <p className="small text-muted">{t("operator:fleet.builder_help")}</p>
          <div className="bbms-builder-canvas">
            <div className="bbms-bus-outline">
              <i className="fas fa-dharmachakra bbms-steering" aria-hidden="true" />
              <div className="bbms-builder-grid" style={{ "--bbms-builder-cols": draft.columns } as CSSProperties}>
                {cells}
              </div>
            </div>
          </div>
          {problems.length > 0 && (
            <ul className="text-danger small mt-2 mb-0">
              {problems.map((problem, i) => (
                <li key={i}>{t(`operator:fleet.problem.${problem.kind}`, { number: "seatNumber" in problem ? problem.seatNumber : "" })}</li>
              ))}
            </ul>
          )}
          <ApiErrorAlert error={error} className="py-2 mt-3 mb-0" />
        </Card>
        <Card title={t("operator:fleet.passenger_view")}>
          <p className="small text-muted">{t("operator:fleet.passenger_view_help")}</p>
          <SeatMap key={`${deck}-${seatCount}`} seats={previewSeats} selectedSeatIds={[]} onChangeSelection={() => undefined} />
          <div className="mt-3">
            <SeatLegend />
          </div>
        </Card>
      </div>
      <div className="col-xl-4">
        <Card title={t("operator:fleet.properties")}>
          <Form.Group className="mb-2" controlId="layout-name">
            <Form.Label>{t("operator:fleet.layout_name")}</Form.Label>
            <Form.Control value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-2" controlId="layout-bus-type">
            <Form.Label>{t("operator:fleet.bus_type")}</Form.Label>
            <Form.Select value={busType} onChange={(e) => setBusType(e.target.value as BusType)}>
              {(["seated", "sleeper", "mixed"] as const).map((type) => (
                <option key={type} value={type}>
                  {t(`operator:bus_type.${type}`)}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <div className="row g-2 mb-3">
            <Form.Group className="col-4" controlId="layout-decks">
              <Form.Label>{t("operator:fleet.decks")}</Form.Label>
              <Form.Select value={draft.decks} disabled={readOnly} onChange={(e) => setGrid({ decks: Number(e.target.value) })}>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="col-4" controlId="layout-rows">
              <Form.Label>{t("operator:fleet.rows")}</Form.Label>
              <Form.Control
                type="number"
                min={1}
                max={MAX_ROWS}
                value={draft.rows}
                disabled={readOnly}
                onChange={(e) => setGrid({ rows: Math.min(MAX_ROWS, Math.max(1, Number(e.target.value) || 1)) })}
              />
            </Form.Group>
            <Form.Group className="col-4" controlId="layout-columns">
              <Form.Label>{t("operator:fleet.columns")}</Form.Label>
              <Form.Control
                type="number"
                min={1}
                max={MAX_COLUMNS}
                value={draft.columns}
                disabled={readOnly}
                onChange={(e) => setGrid({ columns: Math.min(MAX_COLUMNS, Math.max(1, Number(e.target.value) || 1)) })}
              />
            </Form.Group>
          </div>
          {!readOnly && (
            <Form.Group className="mb-3" controlId="layout-pattern">
              <Form.Label>{t("operator:fleet.pattern")}</Form.Label>
              <div className="d-flex gap-2">
                <Form.Control value={pattern} maxLength={MAX_COLUMNS} onChange={(e) => setPattern(e.target.value.toUpperCase())} />
                <button type="button" className="btn btn-outline-primary text-nowrap" onClick={regenerate}>
                  {t("operator:fleet.generate")}
                </button>
              </div>
              <Form.Text>{t("operator:fleet.pattern_help")}</Form.Text>
            </Form.Group>
          )}
          <hr />
          <h6>{t("operator:fleet.selected_seat")}</h6>
          {selectedSeat ? (
            <>
              <Form.Group className="mb-2" controlId="seat-number">
                <Form.Label>{t("operator:fleet.seat_number")}</Form.Label>
                <Form.Control
                  value={selectedSeat.seat_number}
                  maxLength={10}
                  disabled={readOnly}
                  onChange={(e) => updateSelected({ seat_number: e.target.value.toUpperCase() })}
                />
              </Form.Group>
              <Form.Group className="mb-2" controlId="seat-type">
                <Form.Label>{t("operator:fleet.seat_type")}</Form.Label>
                <Form.Select
                  value={selectedSeat.seat_type}
                  disabled={readOnly}
                  onChange={(e) => updateSelected({ seat_type: e.target.value as SeatInput["seat_type"] })}
                >
                  <option value="normal">{t("operator:fleet.seat_normal")}</option>
                  <option value="vip">{t("operator:fleet.seat_vip")}</option>
                </Form.Select>
              </Form.Group>
              <Form.Check
                type="switch"
                id="seat-female"
                label={t("operator:fleet.female_only")}
                checked={selectedSeat.is_female_only}
                disabled={readOnly}
                onChange={(e) => updateSelected({ is_female_only: e.target.checked })}
              />
            </>
          ) : (
            <p className="small text-muted mb-0">{t("operator:fleet.select_seat_hint")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
