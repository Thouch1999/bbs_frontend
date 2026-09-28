// Back-office charts (recharts). Conventions, per the data-viz method:
// - one y-axis per chart: USD and KHR are different scales, so every money
//   chart plots ONE currency (the caller's toggle), never both on two axes;
// - single-series charts use brand teal and no legend box (the card title
//   names the series); multi-series (payment methods) use the validated
//   categorical palette below, mapped per method in a fixed order so a
//   filter never repaints the survivors, and always carry a legend;
// - thin marks (bars <= 24px, 4px rounded data-end, 2px lines), hairline
//   solid grid, text in text tokens (never the series color);
// - every value is also reachable without hover (a table on the same page).
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import { useLocale } from "../../context/LocaleContext";
import type { Currency } from "../../types/operator";
import { formatMoney } from "../../utils/money";
import { formatDate } from "../../utils/time";

const TEAL = "#0D5F6E";
const ORANGE = "#F58220";
const GRID = "#E2E8EC";
const TEXT_MUTED = "#5C6B78";
const SURFACE = "#FFFFFF";

// Validated with the dataviz skill's validate_palette.js (adjacent pairs,
// light surface). The brand teal/orange/gold/gray set FAILED it (gold vs
// orange ΔE 11 < 15 normal-vision floor; teal and gray below the chroma
// floor), so identity uses the reference categorical order instead. Slots 3-5
// sit under 3:1 contrast, so the page must show a table / legend values too.
export const PAYMENT_COLORS: Record<string, string> = {
  aba_payway: "#2a78d6",
  wing: "#eb6834",
  acleda: "#1baf7a",
  counter: "#eda100",
  mock: "#e87ba4",
};
export const PAYMENT_ORDER = Object.keys(PAYMENT_COLORS);

const AXIS_TICK = { fill: TEXT_MUTED, fontSize: 12 };

function compact(value: number, currency: Currency): string {
  const symbol = currency === "USD" ? "$" : "៛";
  if (Math.abs(value) >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 10_000) return `${symbol}${Math.round(value / 1000)}k`;
  return `${symbol}${value.toLocaleString()}`;
}

interface TooltipRow {
  key: string;
  label: ReactNode;
  value: string;
  color: string;
}

function TooltipCard({ title, rows }: { title: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="bg-white border rounded shadow-sm px-2 py-1 small">
      <div className="text-muted">{title}</div>
      {rows.map((row) => (
        <div key={row.key} className="d-flex align-items-center gap-2">
          <span style={{ width: 12, height: 2, background: row.color, display: "inline-block" }} aria-hidden="true" />
          <strong>{row.value}</strong>
          <span className="text-muted">{row.label}</span>
        </div>
      ))}
    </div>
  );
}

// --- Revenue over time (single series) --------------------------------------
// Gradient fill + a dashed average line + a highlighted peak day, per the
// operator-dashboard redesign — still one series/one y-axis/one color (teal),
// just with more of the series' own shape made visible without a hover.
export function RevenueLineChart({ points, currency }: { points: { date: string; total: number }[]; currency: Currency }) {
  const { t } = useTranslation("operator");
  const { language } = useLocale();
  const average = points.length ? points.reduce((sum, p) => sum + p.total, 0) / points.length : 0;
  const peak = points.reduce((best, p) => (p.total > (best?.total ?? -Infinity) ? p : best), points[0]);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={TEAL} stopOpacity={0.18} />
            <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={(d: string) => d.slice(8)} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tick={AXIS_TICK} tickFormatter={(v: number) => compact(v, currency)} axisLine={false} tickLine={false} width={64} />
        <Tooltip
          cursor={{ stroke: TEXT_MUTED, strokeWidth: 1 }}
          content={({ active, payload, label }: TooltipProps<number, string>) =>
            active && payload?.length ? (
              <TooltipCard
                title={formatDate(String(label), language)}
                rows={[{ key: "v", label: "", value: formatMoney(String(payload[0].value ?? 0), currency, language), color: TEAL }]}
              />
            ) : null
          }
        />
        {average > 0 && (
          <ReferenceLine y={average} stroke={TEXT_MUTED} strokeDasharray="4 4" strokeOpacity={0.7} />
        )}
        <Area
          type="monotone"
          dataKey="total"
          stroke="none"
          fill="url(#revenueFill)"
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="total"
          stroke={TEAL}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={false}
          activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2, fill: TEAL }}
          isAnimationActive={false}
        />
        {peak && peak.total > 0 && (
          <ReferenceDot
            x={peak.date}
            y={peak.total}
            r={5}
            fill={ORANGE}
            stroke={SURFACE}
            strokeWidth={2}
            label={{
              value: `${t("dashboard.peak")}: ${formatMoney(String(peak.total), currency, language)}`,
              position: "top",
              fill: TEAL,
              fontSize: 11,
              fontWeight: 700,
            }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// --- Ranked progress list (e.g. top routes by seats sold) -------------------
// A numbered-badge + proportional-bar list, not an XY chart — matches the
// operator-dashboard redesign's "top routes" card. Bar length is relative to
// the top row (not a % of some unknown grand total), so it never implies a
// share of all bookings it can't actually prove.
const RANK_COLORS = [TEAL, ORANGE, "#5C6B78", "#5C6B78", "#5C6B78"];

export function RankedProgressList({
  rows,
  valueLabel,
}: {
  rows: { key: string; name: string; value: number }[];
  valueLabel: (value: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
      {rows.map((row, index) => {
        const color = RANK_COLORS[index] ?? TEXT_MUTED;
        const width = Math.round((row.value / max) * 100);
        return (
          <li key={row.key}>
            <div className="d-flex align-items-center justify-content-between small mb-1 gap-2">
              <span className="d-flex align-items-center gap-2 fw-semibold text-truncate">
                <span
                  className="d-inline-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
                  style={{ width: 20, height: 20, borderRadius: "50%", background: color, fontSize: 11 }}
                >
                  {index + 1}
                </span>
                <span className="text-truncate">{row.name}</span>
              </span>
              <span className="fw-bold text-nowrap" style={{ color }}>
                {valueLabel(row.value)}
              </span>
            </div>
            <div className="bbms-progress-track">
              <div className="bbms-progress-fill" style={{ width: `${width}%`, background: color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// --- Daily revenue stacked by payment method (one currency) ------------------
export function StackedRevenueChart({
  days,
  providers,
  currency,
}: {
  days: Record<string, number | string>[];
  providers: string[];
  currency: Currency;
}) {
  const { t } = useTranslation("operator");
  const { language } = useLocale();
  const ordered = PAYMENT_ORDER.filter((p) => providers.includes(p));
  return (
    <>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={(d: string) => d.slice(5)} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis tick={AXIS_TICK} tickFormatter={(v: number) => compact(v, currency)} axisLine={false} tickLine={false} width={64} />
          <Tooltip
            cursor={{ fill: "rgba(13,95,110,0.06)" }}
            content={({ active, payload, label }: TooltipProps<number, string>) =>
              active && payload?.length ? (
                <TooltipCard
                  title={formatDate(String(label), language)}
                  rows={[...payload].reverse().map((entry) => ({
                    key: String(entry.dataKey),
                    label: t(`payment_method.${entry.dataKey}`),
                    value: formatMoney(String(entry.value ?? 0), currency, language),
                    color: PAYMENT_COLORS[String(entry.dataKey)] ?? TEXT_MUTED,
                  }))}
                />
              ) : null
            }
          />
          {ordered.map((provider, index) => (
            <Bar
              key={provider}
              dataKey={provider}
              stackId="revenue"
              fill={PAYMENT_COLORS[provider]}
              stroke={SURFACE}
              strokeWidth={2}
              maxBarSize={24}
              radius={index === ordered.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <ChartLegend items={ordered.map((p) => ({ key: p, label: t(`payment_method.${p}`), color: PAYMENT_COLORS[p] }))} />
    </>
  );
}

// --- Payment-method share (part-to-whole, <= 5 segments) ---------------------
export function ShareDonut({ slices, currency }: { slices: { provider: string; total: number }[]; currency: Currency }) {
  const { t } = useTranslation("operator");
  const { language } = useLocale();
  const ordered = PAYMENT_ORDER.flatMap((p) => slices.filter((s) => s.provider === p));
  const sum = ordered.reduce((acc, s) => acc + s.total, 0);
  return (
    <>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={ordered}
            dataKey="total"
            nameKey="provider"
            innerRadius="58%"
            outerRadius="90%"
            stroke={SURFACE}
            strokeWidth={2}
            isAnimationActive={false}
          >
            {ordered.map((slice) => (
              <Cell key={slice.provider} fill={PAYMENT_COLORS[slice.provider] ?? TEXT_MUTED} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }: TooltipProps<number, string>) =>
              active && payload?.length ? (
                <TooltipCard
                  title={t(`payment_method.${payload[0].name}`)}
                  rows={[
                    {
                      key: "v",
                      label: `${sum ? Math.round((Number(payload[0].value) / sum) * 100) : 0}%`,
                      value: formatMoney(String(payload[0].value ?? 0), currency, language),
                      color: PAYMENT_COLORS[String(payload[0].name)] ?? TEXT_MUTED,
                    },
                  ]}
                />
              ) : null
            }
          />
        </PieChart>
      </ResponsiveContainer>
      <ChartLegend
        items={ordered.map((s) => ({
          key: s.provider,
          label: `${t(`payment_method.${s.provider}`)} — ${sum ? Math.round((s.total / sum) * 100) : 0}%`,
          color: PAYMENT_COLORS[s.provider] ?? TEXT_MUTED,
        }))}
      />
    </>
  );
}

function ChartLegend({ items }: { items: { key: string; label: string; color: string }[] }) {
  return (
    <ul className="list-inline small mb-0 mt-2">
      {items.map((item) => (
        <li key={item.key} className="list-inline-item me-3">
          <span
            aria-hidden="true"
            style={{ width: 10, height: 10, borderRadius: 2, background: item.color, display: "inline-block", marginRight: 6 }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** "Revenue in ៛ / $" toggle that picks the one currency a money chart plots. */
export function CurrencyToggle({ value, onChange }: { value: Currency; onChange: (c: Currency) => void }) {
  const { t } = useTranslation("operator");
  return (
    <div className="btn-group btn-group-sm" role="group" aria-label={t("charts.currency")}>
      {(["USD", "KHR"] as const).map((c) => (
        <button key={c} type="button" className={`btn btn-outline-secondary ${value === c ? "active" : ""}`} onClick={() => onChange(c)}>
          {c === "USD" ? "$" : "៛"}
        </button>
      ))}
    </div>
  );
}

// --- Counts over time (single series, e.g. bookings per day) ------------------
export function CountLineChart({ points, label }: { points: { date: string; value: number }[]; label: string }) {
  const { language } = useLocale();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={(d: string) => d.slice(8)} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
        <Tooltip
          cursor={{ stroke: TEXT_MUTED, strokeWidth: 1 }}
          content={({ active, payload, label: day }: TooltipProps<number, string>) =>
            active && payload?.length ? (
              <TooltipCard
                title={formatDate(String(day), language)}
                rows={[{ key: "v", label, value: String(payload[0].value ?? 0), color: TEAL }]}
              />
            ) : null
          }
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={TEAL}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={false}
          activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2, fill: TEAL }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
