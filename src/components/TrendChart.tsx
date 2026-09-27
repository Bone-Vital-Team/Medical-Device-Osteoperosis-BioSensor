import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Reading, Source } from "../lib/model";
import { sourceLabel } from "../lib/model";
import { formatDate, formatNumber } from "../lib/readings";
import { Empty } from "./UI";

export function TrendChart({
  readings,
  metric = "ratioNmolMmol",
  compact = false,
}: {
  readings: Reading[];
  metric?: "ratioNmolMmol" | "dpdNmolL";
  compact?: boolean;
}) {
  const ordered = [...readings].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
  const data = ordered.map((r) => ({
    ...r,
    date: Date.parse(r.timestamp),
    value: r[metric],
    demoValue: r.calibration === "demo-inverse-v1" ? r[metric] : null,
    manualValue: r.calibration === "manual-entry" ? r[metric] : null,
  }));
  const unit = metric === "dpdNmolL" ? "nmol/L" : "nmol/mmol";
  if (!data.length)
    return (
      <Empty title="No readings in this view">
        Try another time range or record your first test.
      </Empty>
    );
  return (
    <div
      className="chart-wrap"
      role="img"
      aria-label={`${metric === "dpdNmolL" ? "DPD concentration" : "DPD to creatinine ratio"} chart. ${data.filter((d) => d.value !== null).length} available results. Exact values are listed in History.`}
    >
      <div className="axis-unit">{unit}</div>
      <div className={`chart ${compact ? "compact" : ""}`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={1}>
          <ComposedChart
            data={data}
            margin={{ left: -20, top: 18, right: 15, bottom: 5 }}
            accessibilityLayer
          >
            <defs>
              <linearGradient
                id={`fill-${metric}-${compact}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#169588" stopOpacity={0.17} />
                <stop offset="100%" stopColor="#169588" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 5"
              vertical={false}
              stroke="#e5ebee"
            />
            <XAxis
              dataKey="date"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v) =>
                new Date(v).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              }
              tick={{ fill: "#66778b", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              minTickGap={30}
              dy={10}
            />
            <YAxis
              domain={[0, "auto"]}
              tick={{ fill: "#66778b", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickCount={5}
              width={54}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as Reading;
                return (
                  <div className="chart-tooltip">
                    <strong>{formatDate(r.timestamp, true)}</strong>
                    <span>
                      {formatNumber(r[metric])} {unit}
                    </span>
                    <small>
                      {sourceLabel[r.source]} ·{" "}
                      {r.calibration === "demo-inverse-v1"
                        ? "Demo calibration"
                        : "Manual DPD entry"}
                    </small>
                  </div>
                );
              }}
            />
            <Area
              type="linear"
              dataKey="demoValue"
              stroke="#0d8177"
              strokeWidth={2.5}
              fill={`url(#fill-${metric}-${compact})`}
              connectNulls={false}
              isAnimationActive={false}
              dot={{ r: 4, fill: "#fff", stroke: "#0d8177", strokeWidth: 2 }}
              activeDot={{ r: 6, strokeWidth: 3, stroke: "#fff" }}
            />
            <Area
              type="linear"
              dataKey="manualValue"
              stroke="#776499"
              strokeDasharray="5 4"
              strokeWidth={2.5}
              fill="#77649910"
              connectNulls={false}
              isAnimationActive={false}
              dot={{ r: 4, fill: "#fff", stroke: "#776499", strokeWidth: 2 }}
              activeDot={{ r: 6, strokeWidth: 3, stroke: "#fff" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {ordered.some((r) => r[metric] === null) && (
        <p className="chart-note">
          Missing measurements appear as gaps, not zeros. No concentration is
          inferred from a missing signal.
        </p>
      )}
      {ordered.some((r) => r.calibration === "manual-entry") && (
        <p className="chart-note">
          Dashed purple: manually entered DPD. Solid teal: demonstration
          conversion. Different methods are not connected.
        </p>
      )}
    </div>
  );
}
export function RangeControls({
  days,
  setDays,
  source,
  setSource,
}: {
  days: number;
  setDays(n: number): void;
  source: Source;
  setSource(s: Source): void;
}) {
  return (
    <div className="range-controls">
      <select
        aria-label="Reading source"
        value={source}
        onChange={(e) => setSource(e.target.value as Source)}
      >
        <option value="demo">Simulated readings</option>
        <option value="manual">Manual readings</option>
        <option value="device">Device readings</option>
      </select>
      <div className="segments" role="group" aria-label="Time range">
        {[7, 30, 90, 0].map((n) => (
          <button
            key={n}
            aria-pressed={days === n}
            className={days === n ? "active" : ""}
            onClick={() => setDays(n)}
          >
            {n ? `${n} days` : "All"}
          </button>
        ))}
      </div>
    </div>
  );
}
