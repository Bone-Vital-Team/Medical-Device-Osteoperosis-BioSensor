import { useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  Check,
  FlaskConical,
  LoaderCircle,
  PenLine,
  Save,
  Usb,
  Waves,
} from "lucide-react";
import type { ConnectionState, Reading, Settings } from "../lib/model";
import { createReading, formatNumber } from "../lib/readings";
import { SimulatedAdapter, serialSupported } from "../lib/hardware";
import type { WebSerialAdapter } from "../lib/hardware";
import { Notice } from "./UI";

export function ReadingForm({
  settings,
  adapter,
  connection,
  onSave,
  onConnectionError,
}: {
  settings: Settings;
  adapter: WebSerialAdapter;
  connection: ConnectionState;
  onSave(reading: Reading): boolean;
  onConnectionError(message: string): void;
}) {
  const [mode, setMode] = useState<"demo" | "manual" | "device">(
    settings.hardwareMode,
  );
  const [method, setMethod] = useState<"current" | "dpd">("current");
  const [current, setCurrent] = useState("");
  const [dpd, setDpd] = useState("");
  const [creatinine, setCreatinine] = useState("");
  const [voltage, setVoltage] = useState("");
  const [notes, setNotes] = useState("");
  const [stripId, setStripId] = useState("");
  const [noSignal, setNoSignal] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [captured, setCaptured] = useState(false);
  const [saved, setSaved] = useState(false);
  const numeric = (value: string) =>
    value.trim() === "" ? null : Number(value);
  const factor = settings.currentUnit === "nA" ? 1000 : 1;
  function makeReading() {
    return createReading({
      source: mode,
      method: mode === "manual" ? method : "current",
      currentUa:
        mode === "manual" && method === "dpd"
          ? null
          : numeric(current) === null
            ? null
            : Number(current) / factor,
      dpdNmolL: numeric(dpd),
      creatinineMmolL: numeric(creatinine),
      voltageV: numeric(voltage),
      signalDetected: !noSignal,
      notes,
      stripId,
    });
  }
  let preview: Reading | null = null;
  try {
    preview = makeReading();
  } catch {
    /* Validation shown on submit, without discarding input. */
  }
  function changeMode(next: typeof mode) {
    setMode(next);
    setCurrent("");
    setDpd("");
    setCreatinine("");
    setVoltage("");
    setCaptured(false);
    setSaved(false);
    setNoSignal(false);
    setError("");
  }
  async function acquire() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setSaved(false);
    setError("");
    setCaptured(false);
    try {
      const simulator = new SimulatedAdapter(noSignal);
      if (mode === "demo") await simulator.connect();
      const frame = await (mode === "device" ? adapter : simulator).read();
      if (mode === "demo") await simulator.disconnect();
      setCurrent(String(frame.currentUa * factor));
      setVoltage(frame.voltageV === null ? "" : String(frame.voltageV));
      setNoSignal(!frame.signalDetected);
      if (mode === "demo") setCreatinine("8.5");
      setCaptured(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function connect() {
    setError("");
    try {
      await adapter.connect();
    } catch (e) {
      setError((e as Error).message);
      onConnectionError((e as Error).message);
    }
  }
  const isCurrent = mode !== "manual" || method === "current";
  return (
    <div className="reading-layout">
      <section className="card form-card">
        <div className="section-kicker">01 · INPUT SOURCE</div>
        <h2>Start with a reading</h2>
        <p className="muted">Choose how you’d like to add your test.</p>
        <div className="mode-options" role="group" aria-label="Input source">
          {(
            [
              ["demo", FlaskConical, "Simulated"],
              ["manual", PenLine, "Manual input"],
              ["device", Usb, "Device"],
            ] as const
          ).map(([key, Icon, label]) => (
            <button
              disabled={busy}
              key={key}
              className={mode === key ? "selected" : ""}
              onClick={() => changeMode(key)}
              aria-pressed={mode === key}
            >
              <Icon size={21} />
              <span>{label}</span>
              {mode === key && <Check size={13} className="selected-check" />}
            </button>
          ))}
        </div>
        {mode === "demo" && (
          <>
            <Notice>
              Simulated mode creates fictional data using a demonstration curve.
              No reader is connected.
            </Notice>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={noSignal}
                disabled={busy}
                onChange={(e) => {
                  setNoSignal(e.target.checked);
                  setCurrent("");
                  setCaptured(false);
                  setSaved(false);
                }}
              />
              Simulate no electrical signal
            </label>
            <button
              className="button primary full"
              disabled={busy}
              onClick={acquire}
            >
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Waves size={18} />
              )}
              {busy ? "Simulating reading…" : "Generate simulated reading"}
            </button>
          </>
        )}
        {mode === "device" && (
          <>
            <Notice tone="warning">
              Hardware protocol setup is required. Actual device data is stored
              as raw current only; no validated DPD calibration is configured.
            </Notice>
            <div className="device-actions">
              <span className={`connection ${connection}`}>
                <Usb size={15} />
                {connection}
              </span>
              <button
                className="button secondary"
                disabled={
                  busy ||
                  connection === "connecting" ||
                  connection === "connected" ||
                  connection === "reading"
                }
                onClick={connect}
              >
                Connect reader
              </button>
              {connection !== "disconnected" && (
                <button
                  className="button secondary"
                  onClick={async () => {
                    try {
                      await adapter.disconnect();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Disconnect
                </button>
              )}
            </div>
            {!serialSupported() && (
              <p className="small muted">
                USB serial requires a compatible desktop browser and HTTPS or
                localhost. You can use simulated mode on any device.
              </p>
            )}
            <button
              className="button primary full"
              disabled={busy || connection !== "connected"}
              onClick={acquire}
            >
              <Activity size={17} />
              {busy ? "Waiting for a frame…" : "Capture device reading"}
            </button>
            <p className="small muted">
              Example protocol: 115200 baud, newline-delimited bonevital-v1
              JSON. The app listens only; it does not apply a voltage.
            </p>
          </>
        )}
        {mode === "manual" && (
          <>
            <label className="field">
              Value to enter
              <select
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value as "dpd" | "current");
                  setSaved(false);
                  setNoSignal(false);
                }}
              >
                <option value="current">
                  Raw current · demonstration conversion
                </option>
                <option value="dpd">
                  DPD concentration · independently measured
                </option>
              </select>
            </label>
            <Notice>
              Manually entered results are labeled as such. Current conversion
              is illustrative, and not suitable for medical decisions.
            </Notice>
          </>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            try {
              if (mode !== "manual" && !captured)
                throw new Error("Capture a new reading first.");
              const result = makeReading();
              if (onSave(result)) {
                setSaved(true);
                setCaptured(false);
              }
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <div className="form-divider" />
          <div className="section-kicker">02 · TEST DETAILS</div>
          <div className="form-grid">
            {isCurrent ? (
              <label className="field">
                Raw current ({settings.currentUnit})
                <input
                  inputMode="decimal"
                  type="number"
                  step="any"
                  value={current}
                  readOnly={mode !== "manual"}
                  placeholder={
                    mode === "manual"
                      ? (factor * 16).toString()
                      : "Awaiting reading"
                  }
                  onChange={(e) => {
                    setCurrent(e.target.value);
                    setSaved(false);
                  }}
                />
                <span className="field-hint">
                  {mode === "device"
                    ? "Received from the reader"
                    : `Demo range: ${5 * factor}–${100 * factor} ${settings.currentUnit}`}
                </span>
              </label>
            ) : (
              <label className="field">
                DPD concentration (nmol/L)
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={dpd}
                  onChange={(e) => {
                    setDpd(e.target.value);
                    setSaved(false);
                  }}
                  placeholder="52.7"
                />
              </label>
            )}
            <label className="field">
              Creatinine (mmol/L)
              {(noSignal || mode === "device") && (
                <span className="optional">Optional</span>
              )}
              <input
                type="number"
                step="any"
                inputMode="decimal"
                min="0.000001"
                value={creatinine}
                onChange={(e) => {
                  setCreatinine(e.target.value);
                  setSaved(false);
                }}
                placeholder="8.5"
              />
              <span className="field-hint">
                {mode === "demo"
                  ? "Synthetic value for demonstration"
                  : "Measured independently, not from DPD current"}
              </span>
            </label>
            <label className="field">
              Applied voltage (V)<span className="optional">Optional</span>
              <input
                type="number"
                step="any"
                value={voltage}
                readOnly={mode !== "manual"}
                placeholder="0.3"
                onChange={(e) => {
                  setVoltage(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
            <label className="field">
              Test-strip ID<span className="optional">Optional</span>
              <input
                maxLength={100}
                value={stripId}
                onChange={(e) => {
                  setStripId(e.target.value);
                  setSaved(false);
                }}
                placeholder="e.g. STRIP-001"
              />
            </label>
          </div>
          {mode === "manual" && method === "current" && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={noSignal}
                onChange={(e) => {
                  setNoSignal(e.target.checked);
                  setSaved(false);
                  if (e.target.checked) setCurrent("0");
                }}
              />
              No electrical signal detected
            </label>
          )}
          <label className="field">
            Notes<span className="optional">Optional</span>
            <textarea
              rows={3}
              maxLength={2000}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setSaved(false);
              }}
              placeholder="Anything you’d like to remember about this test…"
            />
          </label>
          {error && <Notice tone="error">{error}</Notice>}
          {saved && (
            <Notice tone="success">
              Reading saved to this browser. Find it in History.
            </Notice>
          )}
          <div className="form-footer">
            <span>
              <Save size={14} />
              Saved only on this browser
            </span>
            <button
              className="button primary"
              type="submit"
              disabled={busy || saved}
            >
              {saved ? <Check size={17} /> : <Save size={17} />}
              {saved ? "Saved" : "Save result"}
            </button>
          </div>
        </form>
      </section>
      <aside className="reading-aside">
        <section className="card result-preview">
          <span className="section-kicker">RESULT PREVIEW</span>
          <h2>Your reading, explained</h2>
          <div className="preview-number">
            {formatNumber(preview?.ratioNmolMmol)}
            <span>nmol/mmol</span>
          </div>
          <p className="muted">DPD-to-creatinine ratio</p>
          <div className="formula">
            <span>DPD</span>
            <ArrowRight size={16} />
            <span>÷ Creatinine</span>
            <ArrowRight size={16} />
            <span>Ratio</span>
          </div>
          {preview ? (
            <Notice
              tone={preview.status === "recorded" ? "success" : "warning"}
            >
              {preview.status === "no-signal"
                ? "No new DPD signal detected. This is an unavailable measurement, not proof of absent DPD."
                : preview.status === "uncalibrated"
                  ? "Raw data only. A validated calibration is required before deriving DPD."
                  : "Ready to record. This confirms complete input, not clinical validity."}
            </Notice>
          ) : (
            <p className="small muted">
              Add a reading and creatinine value to preview the normalized
              result.
            </p>
          )}
        </section>
        <section className="card subtle-card">
          <h3>Before you save</h3>
          <ul className="checklist">
            <li>Use a new strip for each physical test.</li>
            <li>Check the source and units carefully.</li>
            <li>Use creatinine from the same sample.</li>
            <li>Discuss interpretation with your healthcare professional.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
