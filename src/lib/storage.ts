import { defaultSettings, UNITS } from "./model";
import type { StoreData, Reading, Settings } from "./model";
import { createReading } from "./readings";
export const STORAGE_KEY = "bonevital:v1";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export function validateStore(value: unknown): StoreData {
  if (!value || typeof value !== "object") throw new Error("Invalid backup.");
  const data = value as Record<string, unknown>;
  if (
    data.version !== 1 ||
    !Array.isArray(data.readings) ||
    data.readings.length > 10000
  )
    throw new Error("Unsupported backup version or too many records.");
  const settings = data.settings as Settings;
  if (
    !settings ||
    typeof settings.displayName !== "string" ||
    settings.displayName.length > 100 ||
    typeof settings.anonymous !== "boolean" ||
    !["µA", "nA"].includes(settings.currentUnit) ||
    !["demo", "device"].includes(settings.hardwareMode)
  )
    throw new Error("Invalid settings in backup.");
  const ids = new Set<string>();
  const readings = data.readings.map((value: unknown) => {
    if (!value || typeof value !== "object") throw new Error("Invalid record.");
    const r = value as Reading;
    if (
      typeof r.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(r.id) ||
      ids.has(r.id) ||
      typeof r.timestamp !== "string" ||
      typeof r.notes !== "string" ||
      typeof r.stripId !== "string"
    )
      throw new Error("Invalid or duplicate record.");
    if (
      !r.units ||
      Object.entries(UNITS).some(
        ([key, unit]) => r.units[key as keyof typeof UNITS] !== unit,
      )
    )
      throw new Error(
        "Unsupported units; expected µA, V, nmol/L, mmol/L, and nmol/mmol.",
      );
    const clean = createReading(r);
    if (
      r.status !== clean.status ||
      r.calibration !== clean.calibration ||
      r.signalDetected !== clean.signalDetected
    )
      throw new Error("Inconsistent result metadata.");
    for (const key of ["dpdNmolL", "ratioNmolMmol"] as const) {
      if (
        r[key] !== clean[key] &&
        !(
          typeof r[key] === "number" &&
          typeof clean[key] === "number" &&
          Math.abs(r[key]! - clean[key]!) < 1e-8
        )
      )
        throw new Error("Inconsistent result calculation.");
    }
    ids.add(r.id);
    return { ...clean, id: r.id };
  });
  return {
    version: 1,
    readings,
    settings: {
      displayName: settings.displayName,
      anonymous: settings.anonymous,
      currentUnit: settings.currentUnit,
      hardwareMode: settings.hardwareMode,
    },
  };
}
export function loadStore(storage: StorageLike): StoreData | null {
  const text = storage.getItem(STORAGE_KEY);
  return text ? validateStore(JSON.parse(text)) : null;
}
export function saveStore(storage: StorageLike, data: StoreData): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(validateStore(data)));
}
export function clearStore(storage: StorageLike): void {
  storage.removeItem(STORAGE_KEY);
}
export function emptyStore(): StoreData {
  return { version: 1, readings: [], settings: { ...defaultSettings } };
}
