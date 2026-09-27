import { useState } from "react";
import {
  Download,
  LockKeyhole,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import type { Settings, StoreData } from "../lib/model";
import { Notice } from "./UI";
import { createJsonBackup, downloadFile } from "../lib/export";
import { decodeBackup, encryptBackup } from "../lib/backup";

export function SettingsView({
  data,
  onSettings,
  onRestore,
  onClear,
  onClearDemo,
  onDemo,
}: {
  data: StoreData;
  onSettings(settings: Settings): void;
  onRestore(data: StoreData): void;
  onClear(): void;
  onClearDemo(): void;
  onDemo(): void;
}) {
  const [settings, setSettings] = useState(data.settings);
  const [consent, setConsent] = useState(false);
  const [password, setPassword] = useState("");
  const [encrypted, setEncrypted] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function backup() {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const text = encrypted
        ? await encryptBackup(data, password, consent)
        : createJsonBackup(data, consent);
      downloadFile(
        text,
        `bonevital-${encrypted ? "encrypted-" : ""}backup.json`,
        "application/json",
      );
      setMessage("Backup downloaded. Keep it in a safe place.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function restore(file: File) {
    setError("");
    setBusy(true);
    try {
      if (file.size > 10000000)
        throw new Error("Choose a JSON backup smaller than 10 MB.");
      const result = await decodeBackup(await file.text(), password);
      onRestore(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-layout">
      <div>
        <section className="card form-card">
          <div className="section-heading">
            <div>
              <h2>Make it yours</h2>
              <p className="muted">Preferences stay in this browser.</p>
            </div>
            <ShieldCheck size={22} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSettings(settings);
            }}
          >
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.anonymous}
                onChange={(e) =>
                  setSettings({ ...settings, anonymous: e.target.checked })
                }
              />
              Use anonymous mode
            </label>
            <label className="field">
              Display name
              <input
                maxLength={100}
                value={settings.displayName}
                disabled={settings.anonymous}
                onChange={(e) =>
                  setSettings({ ...settings, displayName: e.target.value })
                }
                placeholder="Your name"
              />
              <span className="field-hint">
                Included on printed reports only when anonymous mode is off.
              </span>
            </label>
            <div className="form-grid">
              <label className="field">
                Current display units
                <select
                  value={settings.currentUnit}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      currentUnit: e.target.value as Settings["currentUnit"],
                    })
                  }
                >
                  <option value="µA">Microamperes (µA)</option>
                  <option value="nA">Nanoamperes (nA)</option>
                </select>
              </label>
              <label className="field">
                Default input mode
                <select
                  value={settings.hardwareMode}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      hardwareMode: e.target.value as Settings["hardwareMode"],
                    })
                  }
                >
                  <option value="demo">Simulated mode</option>
                  <option value="device">Device mode · USB serial</option>
                </select>
              </label>
            </div>
            <p className="small muted">
              DPD: nmol/L · Creatinine: mmol/L · Ratio: nmol/mmol. Exports
              always use canonical units (µA for current).
            </p>
            <button className="button primary" type="submit">
              <Save size={16} />
              Save preferences
            </button>
          </form>
        </section>
        <section className="card form-card">
          <h2>Backup & restore</h2>
          <p className="muted">
            Your data doesn’t sync across browsers or devices. A backup lets you
            take it with you.
          </p>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={encrypted}
              onChange={(e) => setEncrypted(e.target.checked)}
            />
            Encrypt my backup (recommended)
          </label>
          <label className="field">
            Backup passphrase
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 12 characters"
            />
            <span className="field-hint">
              Required for encrypted export or restore. Never stored. Lost
              passphrases cannot be recovered.
            </span>
          </label>
          {!encrypted && (
            <Notice tone="warning">
              An unencrypted JSON backup contains readable health data. Anyone
              with the file can open it.
            </Notice>
          )}
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I consent to downloading a copy of all my results and preferences.
          </label>
          <div className="button-row">
            <button
              className="button primary"
              disabled={!consent || busy}
              onClick={backup}
            >
              <Download size={16} />
              {busy ? "Processing…" : "Download JSON backup"}
            </button>
            <label
              className={`button secondary file-button ${busy ? "disabled" : ""}`}
            >
              <Upload size={16} />
              Restore JSON backup
              <input
                aria-label="Restore JSON backup"
                type="file"
                accept=".json,application/json"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void restore(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          {message && <Notice tone="success">{message}</Notice>}
          <p className="small muted">
            Restore is local and requires confirmation before replacing existing
            data.
          </p>
        </section>
        <section className="card form-card">
          <h2>Manage local data</h2>
          <p className="muted">
            Load fictional readings for a demo, or remove them without affecting
            other results.
          </p>
          <div className="button-row">
            <button className="button secondary" onClick={onDemo}>
              Load demo readings
            </button>
            <button className="button secondary" onClick={onClearDemo}>
              Remove demo readings
            </button>
          </div>
          <div className="form-divider" />
          <p className="small muted">
            Clearing all data deletes readings and resets your preferences in
            this browser. Export a backup first if you need a copy.
          </p>
          <button className="button danger" onClick={onClear}>
            <Trash2 size={16} />
            Clear all local data
          </button>
        </section>
      </div>
      <aside>
        <section className="card privacy-panel">
          <div className="large-icon">
            <LockKeyhole size={25} />
          </div>
          <h2>Your data stays with you</h2>
          <p>
            The app stores readings on this browser. It has no health-data
            server, analytics, ads, or automatic sharing.
          </p>
          <h3>What local storage means</h3>
          <p>
            Browser storage is not encrypted. Someone with access to your
            browser profile may be able to view your records. Clearing browser
            data may erase them.
          </p>
          <h3>You choose what leaves</h3>
          <p>
            CSV, reports, and backups are downloaded only after your consent.
            Files can then be shared by you. No provider or insurance company
            receives results automatically.
          </p>
          <h3>Encryption has limits</h3>
          <p>
            Encrypted backups use AES-256-GCM with a passphrase-derived key. CSV
            and printed reports are not encrypted. Protect exported files and
            only share with a trusted recipient.
          </p>
          <h3>A prototype, not a medical record system</h3>
          <p>
            BoneVital makes no HIPAA certification or compliance claim. Hosting
            providers may process ordinary page-request metadata, but this app
            does not transmit your health readings.
          </p>
        </section>
      </aside>
    </div>
  );
}
