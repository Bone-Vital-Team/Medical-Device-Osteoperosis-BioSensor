import { describe, expect, it } from "vitest";
import {
  demoCurrentToDpd,
  demoDpdToCurrent,
  normalizeDpd,
} from "./calibration";
import { createDemoReadings, createReading } from "./readings";
import {
  clearStore,
  emptyStore,
  loadStore,
  saveStore,
  STORAGE_KEY,
  validateStore,
} from "./storage";
import type { StorageLike } from "./storage";
import { createCsv, createJsonBackup, csvCell, requireConsent } from "./export";
import { decodeBackup, encryptBackup } from "./backup";
import { parseDeviceFrame, SimulatedAdapter } from "./hardware";
const manual = () =>
  createReading({
    source: "manual",
    method: "dpd",
    dpdNmolL: 51,
    creatinineMmolL: 8.5,
  });
const sampleStore = () => ({ ...emptyStore(), readings: [manual()] });
function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe("demonstration calibration and normalization", () => {
  it("uses the documented inverse current curve", () =>
    expect(demoCurrentToDpd(20)).toBe(40));
  it("produces more DPD for less current", () =>
    expect(demoCurrentToDpd(10)).toBeGreaterThan(demoCurrentToDpd(20)));
  it("round-trips demo concentration through current", () =>
    expect(demoCurrentToDpd(demoDpdToCurrent(52.7))).toBeCloseTo(52.7));
  it.each([NaN, Infinity, -1, 0, 4.9, 100.1])(
    "rejects invalid/out-of-range current %s",
    (n) => expect(() => demoCurrentToDpd(n)).toThrow(),
  );
  it("normalizes nmol/L by mmol/L into nmol/mmol", () =>
    expect(normalizeDpd(51, 8.5)).toBe(6));
  it("allows a measured zero DPD concentration", () =>
    expect(normalizeDpd(0, 8.5)).toBe(0));
  it.each([0, -1, NaN, Infinity])("rejects invalid creatinine %s", (n) =>
    expect(() => normalizeDpd(51, n)).toThrow(),
  );
  it("rejects invalid DPD", () => expect(() => normalizeDpd(-1, 8)).toThrow());
});
describe("reading validation and provenance", () => {
  it("requires a DPD value for manual concentration entry", () =>
    expect(() =>
      createReading({ source: "manual", method: "dpd", creatinineMmolL: 8 }),
    ).toThrow());
  it("requires independently supplied creatinine", () =>
    expect(() =>
      createReading({ source: "manual", method: "dpd", dpdNmolL: 51 }),
    ).toThrow());
  it("does not treat missing current as zero", () =>
    expect(() =>
      createReading({
        source: "demo",
        method: "current",
        signalDetected: true,
        creatinineMmolL: 8,
      }),
    ).toThrow());
  it("does not infer electrical signal from a manual DPD entry", () =>
    expect(manual().signalDetected).toBeNull());
  it("keeps no-signal readings but leaves concentration and ratio unavailable", () => {
    const r = createReading({
      source: "demo",
      method: "current",
      currentUa: 0,
      signalDetected: false,
    });
    expect(r.status).toBe("no-signal");
    expect(r.dpdNmolL).toBeNull();
    expect(r.ratioNmolMmol).toBeNull();
  });
  it("never applies demonstration calibration to device data", () => {
    const r = createReading({
      source: "device",
      method: "current",
      currentUa: 20,
      signalDetected: true,
      creatinineMmolL: 8,
    });
    expect(r.status).toBe("uncalibrated");
    expect(r.calibration).toBe("none");
    expect(r.dpdNmolL).toBeNull();
    expect(r.ratioNmolMmol).toBeNull();
  });
  it("rejects mislabeled direct device DPD entries", () =>
    expect(() =>
      createReading({
        source: "device",
        method: "dpd",
        dpdNmolL: 5,
        creatinineMmolL: 8,
      }),
    ).toThrow());
  it("marks all preloaded data as simulated", () =>
    expect(
      createDemoReadings().every(
        (r) => r.source === "demo" && r.calibration === "demo-inverse-v1",
      ),
    ).toBe(true));
  it("uses unique IDs", () =>
    expect(new Set(createDemoReadings().map((r) => r.id)).size).toBe(9));
  it("rejects invalid dates and overly long notes", () => {
    expect(() =>
      createReading({
        source: "manual",
        method: "dpd",
        dpdNmolL: 1,
        creatinineMmolL: 1,
        timestamp: "yesterday",
      }),
    ).toThrow();
    expect(() =>
      createReading({
        source: "manual",
        method: "dpd",
        dpdNmolL: 1,
        creatinineMmolL: 1,
        notes: "a".repeat(2001),
      }),
    ).toThrow();
  });
});
describe("browser storage and restore validation", () => {
  it("round-trips records without changing IDs", () => {
    const s = memoryStorage(),
      data = sampleStore();
    saveStore(s, data);
    expect(loadStore(s)).toEqual(data);
  });
  it("returns null only for missing data", () =>
    expect(loadStore(memoryStorage())).toBeNull());
  it("preserves corrupt data for recovery", () => {
    const s = memoryStorage();
    s.setItem(STORAGE_KEY, "bad json");
    expect(() => loadStore(s)).toThrow();
    expect(s.getItem(STORAGE_KEY)).toBe("bad json");
  });
  it("clears only the application key", () => {
    const s = memoryStorage();
    saveStore(s, sampleStore());
    s.setItem("other", "keep");
    clearStore(s);
    expect(loadStore(s)).toBeNull();
    expect(s.getItem("other")).toBe("keep");
  });
  it("surfaces storage quota failures", () => {
    const s = memoryStorage();
    s.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(() => saveStore(s, sampleStore())).toThrow("QuotaExceededError");
  });
  it("rejects unsupported schemas", () =>
    expect(() => validateStore({ version: 99, readings: [] })).toThrow());
  it("rejects duplicate IDs", () => {
    const d = sampleStore();
    d.readings.push(d.readings[0]);
    expect(() => validateStore(d)).toThrow("duplicate");
  });
  it("rejects inconsistent ratios", () => {
    const d = sampleStore();
    d.readings[0].ratioNmolMmol = 999;
    expect(() => validateStore(d)).toThrow("calculation");
  });
  it("rejects changed units rather than guessing conversions", () => {
    const d = sampleStore();
    (d.readings[0].units as { creatinine: string }).creatinine = "mg/dL";
    expect(() => validateStore(d)).toThrow("units");
  });
  it("rejects forged status", () => {
    const d = sampleStore();
    d.readings[0].status = "no-signal";
    expect(() => validateStore(d)).toThrow("metadata");
  });
});
describe("exports and consent", () => {
  it("requires affirmative consent", () =>
    expect(() => requireConsent(false)).toThrow("consent"));
  it("blocks CSV export without consent", () =>
    expect(() => createCsv([manual()], false)).toThrow("consent"));
  it("blocks backup export without consent", () =>
    expect(() => createJsonBackup(sampleStore(), false)).toThrow("consent"));
  it("requires at least one selected record", () =>
    expect(() => createCsv([], true)).toThrow("Select"));
  it("exports only selected rows with units and provenance", () => {
    const r = manual(),
      csv = createCsv([r], true);
    expect(csv).toContain(r.id);
    expect(csv).toContain("DPD / creatinine (nmol/mmol)");
    expect(csv).toContain("manual-entry");
    expect(csv.split("\r\n")).toHaveLength(2);
  });
  it("escapes commas, quotes and newlines", () =>
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"'));
  it.each(['=HYPERLINK("evil")', " +1", "@SUM(1,2)", "-1", "\t=1"])(
    "neutralizes spreadsheet formula %s",
    (s) => expect(csvCell(s).startsWith("\"'")).toBe(true),
  );
  it("exports unavailable measurements as blanks, not zeros", () => {
    const r = createReading({
      source: "demo",
      method: "current",
      currentUa: 0,
      signalDetected: false,
    });
    expect(createCsv([r], true)).toContain('"0","","","",""');
  });
});
describe("encrypted JSON backups", () => {
  it("round-trips encryption and local decryption", async () => {
    const d = sampleStore();
    const encrypted = await encryptBackup(d, "a long test passphrase", true);
    expect(encrypted).not.toContain(d.readings[0].id);
    expect(await decodeBackup(encrypted, "a long test passphrase")).toEqual(d);
  });
  it("uses a unique salt and IV for every backup", async () => {
    const d = sampleStore();
    const a = await encryptBackup(d, "a long test passphrase", true),
      b = await encryptBackup(d, "a long test passphrase", true);
    expect(a).not.toEqual(b);
  });
  it("rejects incorrect passphrases", async () => {
    const e = await encryptBackup(
      sampleStore(),
      "a long test passphrase",
      true,
    );
    await expect(decodeBackup(e, "wrong passphrase")).rejects.toThrow(
      "Could not open",
    );
  });
  it("rejects short passphrases and missing consent", async () => {
    await expect(encryptBackup(sampleStore(), "short", true)).rejects.toThrow(
      "12",
    );
    await expect(
      encryptBackup(sampleStore(), "a long test passphrase", false),
    ).rejects.toThrow("consent");
  });
  it("also accepts valid unencrypted JSON", async () => {
    const d = sampleStore();
    expect(await decodeBackup(createJsonBackup(d, true), "")).toEqual(d);
  });
  it("rejects oversized imports", async () =>
    await expect(decodeBackup("x".repeat(10000001), "")).rejects.toThrow(
      "large",
    ));
});
describe("hardware transport contract", () => {
  it("parses explicit protocol and units", () =>
    expect(
      parseDeviceFrame(
        '{"protocol":"bonevital-v1","current_uA":18.5,"voltage_V":0.3,"signal_detected":true}',
      ),
    ).toEqual({ currentUa: 18.5, voltageV: 0.3, signalDetected: true }));
  it("accepts explicit no-signal frames", () =>
    expect(
      parseDeviceFrame(
        '{"protocol":"bonevital-v1","current_uA":0,"signal_detected":false}',
      ).signalDetected,
    ).toBe(false));
  it.each([
    "{}",
    "garbage",
    '{"protocol":"other","current_uA":1,"signal_detected":true}',
    '{"protocol":"bonevital-v1","current_uA":"12","signal_detected":true}',
    '{"protocol":"bonevital-v1","current_uA":12}',
  ])("rejects malformed protocol %s", (s) =>
    expect(() => parseDeviceFrame(s)).toThrow(),
  );
  it("requires explicit simulator connection", async () =>
    await expect(new SimulatedAdapter().read()).rejects.toThrow("simulator"));
});
