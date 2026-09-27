import {
  demoCurrentToDpd,
  demoDpdToCurrent,
  normalizeDpd,
} from "./calibration";
import { UNITS } from "./model";
import type { Reading, Source } from "./model";

export interface ReadingInput {
  source: Source;
  method: "current" | "dpd";
  currentUa?: number | null;
  voltageV?: number | null;
  dpdNmolL?: number | null;
  creatinineMmolL?: number | null;
  signalDetected?: boolean | null;
  notes?: string;
  stripId?: string;
  timestamp?: string;
}
function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Secure-context UUID API is unavailable on a local HTTP preview. Random
  // bytes are still available; use a standards-shaped UUID without weak RNG.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const h = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function optionalFinite(n: number | null | undefined, name: string) {
  if (n != null && !Number.isFinite(n))
    throw new Error(`${name} must be a finite number.`);
  return n ?? null;
}
export function createReading(input: ReadingInput): Reading {
  if (
    !["demo", "manual", "device"].includes(input.source) ||
    !["dpd", "current"].includes(input.method)
  )
    throw new Error("Invalid reading source or method.");
  const current = optionalFinite(input.currentUa, "Current");
  const voltage = optionalFinite(input.voltageV, "Voltage");
  const creatinine = optionalFinite(input.creatinineMmolL, "Creatinine");
  if (creatinine !== null && creatinine <= 0)
    throw new Error("Creatinine must be greater than zero.");
  const timestamp = input.timestamp ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(timestamp)))
    throw new Error("Invalid test date.");
  if ((input.notes?.length ?? 0) > 2000 || (input.stripId?.length ?? 0) > 100)
    throw new Error("Notes or strip ID are too long.");
  if (input.source === "device" && input.method !== "current")
    throw new Error("Device readings must contain raw current.");
  if (
    input.method === "current" &&
    (current === null || typeof input.signalDetected !== "boolean")
  )
    throw new Error("A current value and signal status are required.");
  let dpd: number | null = null;
  let ratio: number | null = null;
  let status: Reading["status"] = "recorded";
  let calibration: Reading["calibration"] = "manual-entry";
  const signal = input.method === "dpd" ? null : input.signalDetected!;
  if (input.method === "current" && signal === false) {
    status = "no-signal";
    calibration = "none";
  } else if (input.source === "device") {
    // Safety gate: a transport connection is not assay validation. No clinical
    // result is derived from actual hardware until a validated calibration exists.
    status = "uncalibrated";
    calibration = "none";
  } else {
    if (input.method === "current") {
      dpd = demoCurrentToDpd(current!);
      calibration = "demo-inverse-v1";
    } else {
      dpd = optionalFinite(input.dpdNmolL, "DPD");
      if (dpd === null || dpd < 0)
        throw new Error("Enter a nonnegative DPD value.");
    }
    if (creatinine === null)
      throw new Error(
        "Enter an independently measured creatinine value in mmol/L.",
      );
    ratio = normalizeDpd(dpd, creatinine);
  }
  return {
    id: newId(),
    timestamp: new Date(timestamp).toISOString(),
    source: input.source,
    method: input.method,
    currentUa: current,
    voltageV: voltage,
    dpdNmolL: dpd,
    creatinineMmolL: creatinine,
    ratioNmolMmol: ratio,
    signalDetected: signal,
    status,
    calibration,
    units: { ...UNITS },
    notes: input.notes?.trim() ?? "",
    stripId: input.stripId?.trim() ?? "",
  };
}
export function createDemoReadings(now = new Date()): Reading[] {
  const ratios = [7.2, 6.8, 7.05, 6.5, 6.7, 6.1, 6.35, 5.9, 6.2];
  return ratios.map((ratio, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (8 - i) * 3);
    date.setHours(9, 15, 0, 0);
    const cr = [8.4, 9.1, 8.7, 8, 9.4, 8.6, 9, 8.9, 8.5][i];
    return createReading({
      source: "demo",
      method: "current",
      currentUa: demoDpdToCurrent(ratio * cr),
      creatinineMmolL: cr,
      voltageV: 0.3,
      signalDetected: true,
      timestamp: date.toISOString(),
      stripId: `DEMO-${String(i + 1).padStart(3, "0")}`,
      notes: "Synthetic hackathon data. Not a patient measurement.",
    });
  });
}
export function formatNumber(n: number | null | undefined, digits = 2): string {
  return n == null
    ? "—"
    : n.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
}
export function formatDate(value: string, time = false): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(time ? ({ hour: "numeric", minute: "2-digit" } as const) : {}),
  });
}
