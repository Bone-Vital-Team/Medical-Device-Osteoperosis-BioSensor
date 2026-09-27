export type Source = "demo" | "manual" | "device";
export type Status = "recorded" | "no-signal" | "uncalibrated";
export type Page =
  | "overview"
  | "reading"
  | "trends"
  | "history"
  | "export"
  | "settings"
  | "science";
export type ConnectionState =
  "disconnected" | "connecting" | "connected" | "reading" | "error";
export interface Reading {
  id: string;
  timestamp: string;
  source: Source;
  method: "current" | "dpd";
  currentUa: number | null;
  voltageV: number | null;
  dpdNmolL: number | null;
  creatinineMmolL: number | null;
  ratioNmolMmol: number | null;
  signalDetected: boolean | null;
  status: Status;
  calibration: "demo-inverse-v1" | "manual-entry" | "none";
  units: {
    current: "µA";
    voltage: "V";
    dpd: "nmol/L";
    creatinine: "mmol/L";
    ratio: "nmol/mmol";
  };
  notes: string;
  stripId: string;
}
export interface Settings {
  displayName: string;
  anonymous: boolean;
  currentUnit: "µA" | "nA";
  hardwareMode: "demo" | "device";
}
export interface StoreData {
  version: 1;
  readings: Reading[];
  settings: Settings;
}
export const defaultSettings: Settings = {
  displayName: "",
  anonymous: true,
  currentUnit: "µA",
  hardwareMode: "demo",
};
export const UNITS = {
  current: "µA",
  voltage: "V",
  dpd: "nmol/L",
  creatinine: "mmol/L",
  ratio: "nmol/mmol",
} as const;
export const sourceLabel: Record<Source, string> = {
  demo: "Simulated",
  manual: "Manual entry",
  device: "Device",
};
export const statusLabel: Record<Status, string> = {
  recorded: "Recorded",
  "no-signal": "No signal",
  uncalibrated: "Raw data only",
};
