import type { Reading, StoreData } from "./model";
import { validateStore } from "./storage";
export function requireConsent(consent: boolean): void {
  if (consent !== true)
    throw new Error("Confirm consent before exporting data.");
}
export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  // Spreadsheet formula injection protection, including leading whitespace.
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function createCsv(readings: Reading[], consent: boolean): string {
  requireConsent(consent);
  if (!readings.length) throw new Error("Select at least one result.");
  const headers = [
    "ID",
    "Date (ISO 8601)",
    "Source",
    "Status",
    "Current (µA)",
    "Voltage (V)",
    "DPD (nmol/L)",
    "Creatinine (mmol/L)",
    "DPD / creatinine (nmol/mmol)",
    "Signal detected",
    "Calibration",
    "Strip ID",
    "Notes",
    "Notice",
  ];
  return (
    "\uFEFF" +
    [
      headers,
      ...readings.map((r) => [
        r.id,
        r.timestamp,
        r.source,
        r.status,
        r.currentUa,
        r.voltageV,
        r.dpdNmolL,
        r.creatinineMmolL,
        r.ratioNmolMmol,
        r.signalDetected,
        r.calibration,
        r.stripId,
        r.notes,
        "Prototype only. Not diagnostic. Demo calibration is not validated.",
      ]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n")
  );
}
export function createJsonBackup(data: StoreData, consent: boolean): string {
  requireConsent(consent);
  return JSON.stringify(validateStore(data), null, 2);
}
export function downloadFile(text: string, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
