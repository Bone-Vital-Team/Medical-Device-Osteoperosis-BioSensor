import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Download,
  FileDown,
  FlaskConical,
  History,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Plus,
  Printer,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  Usb,
  Waves,
  X,
} from "lucide-react";
import type {
  ConnectionState,
  Page,
  Reading,
  Settings,
  Source,
  StoreData,
} from "./lib/model";
import { defaultSettings, sourceLabel } from "./lib/model";
import { createDemoReadings, formatDate, formatNumber } from "./lib/readings";
import {
  clearStore,
  emptyStore,
  loadStore,
  saveStore,
  STORAGE_KEY,
} from "./lib/storage";
import { createCsv, downloadFile, requireConsent } from "./lib/export";
import { WebSerialAdapter } from "./lib/hardware";
import {
  Empty,
  Modal,
  Notice,
  SourceBadge,
  StatusBadge,
  TextLink,
} from "./components/UI";
import { RangeControls, TrendChart } from "./components/TrendChart";
import { ReadingForm } from "./components/ReadingForm";
import { SettingsView } from "./components/SettingsView";
import { ScienceView } from "./components/ScienceView";

const navigation: { id: Page; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "reading", label: "New reading", icon: Plus },
  { id: "trends", label: "Trends", icon: TrendingUp },
  { id: "history", label: "Reading history", icon: History },
  { id: "export", label: "Export & sharing", icon: FileDown },
  { id: "science", label: "How it works", icon: CircleHelp },
  { id: "settings", label: "Settings & privacy", icon: SettingsIcon },
];
const titles: Record<Page, [string, string]> = {
  overview: [
    "Your bone health, in perspective.",
    "A clear view of your readings, all in one place.",
  ],
  reading: [
    "A new reading. A little more perspective.",
    "Record a test, explore the simulator, or connect your reader.",
  ],
  trends: [
    "See the bigger picture.",
    "Explore changes over time, with the source always in view.",
  ],
  history: [
    "Every reading, in one place.",
    "Your test history, saved privately in this browser.",
  ],
  export: [
    "Your data. Your decision.",
    "Choose the results you want to take to your next conversation.",
  ],
  science: [
    "A closer look at BoneVital.",
    "The science behind the concept, and the limits of this prototype.",
  ],
  settings: [
    "A space that works for you.",
    "Manage your preferences, backups, and privacy.",
  ],
};
function currentPage(): Page {
  const id = location.hash.slice(1);
  return navigation.some((n) => n.id === id) ? (id as Page) : "overview";
}
function initialize() {
  try {
    return {
      data: loadStore(localStorage) ?? {
        version: 1 as const,
        readings: createDemoReadings(),
        settings: { ...defaultSettings },
      },
      error: "",
    };
  } catch {
    return {
      data: emptyStore(),
      error:
        "Your saved data could not be read. It has not been overwritten. Download the stored copy below, then restore a valid backup or explicitly clear it in Settings.",
    };
  }
}
function NoSignal({ reading }: { reading: Reading }) {
  if (reading.status !== "no-signal") return null;
  return (
    <div className="no-signal">
      <div>
        <Waves size={18} />
        <strong>No new DPD signal detected</strong>
      </div>
      <svg
        viewBox="0 0 400 30"
        preserveAspectRatio="none"
        aria-label="Flat raw signal illustration, not a DPD concentration trend"
        role="img"
      >
        <path
          d="M0 15 H400"
          stroke="#8c99a8"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
      </svg>
      <p>
        No usable measurement. A flat signal does not establish that DPD is
        absent.
      </p>
    </div>
  );
}
export default function App() {
  const [initial] = useState(initialize);
  const [data, setData] = useState<StoreData>(initial.data);
  const [storageError, setStorageError] = useState(initial.error);
  const [page, setPage] = useState<Page>(currentPage);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [connection, setConnection] = useState<ConnectionState>("disconnected");
  const adapter = useRef<WebSerialAdapter | null>(null);
  if (!adapter.current) adapter.current = new WebSerialAdapter(setConnection);
  const [days, setDays] = useState(30);
  const [source, setSource] = useState<Source>(
    data.readings.some((r) => r.source === "demo") ? "demo" : "manual",
  );
  const [query, setQuery] = useState("");
  const [historySource, setHistorySource] = useState("all");
  const [historyStatus, setHistoryStatus] = useState("all");
  const [ascending, setAscending] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [consent, setConsent] = useState(false);
  const [detail, setDetail] = useState<Reading | null>(null);
  const [report, setReport] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    text: string;
    label: string;
    run(): void;
  } | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const ordered = useMemo(
    () =>
      [...data.readings].sort(
        (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
      ),
    [data.readings],
  );
  const latest = ordered[0];
  const filtered = useMemo(
    () =>
      data.readings.filter(
        (r) =>
          r.source === source &&
          (!days || Date.parse(r.timestamp) >= Date.now() - days * 86400000),
      ),
    [data.readings, source, days],
  );
  // Do not compare values from different calibration methods. Charts also let users
  // distinguish provenance; manual-current demo estimates are called out below.
  const valid = [...filtered]
    .filter((r) => r.ratioNmolMmol !== null)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const comparable =
    valid.length > 1 &&
    valid.every((r) => r.calibration === valid[0].calibration);
  const change =
    comparable && valid[0].ratioNmolMmol! > 0
      ? (valid[valid.length - 1].ratioNmolMmol! / valid[0].ratioNmolMmol! - 1) *
        100
      : null;
  const shown = ordered.filter(
    (r) =>
      (historySource === "all" || r.source === historySource) &&
      (historyStatus === "all" || r.status === historyStatus) &&
      `${r.stripId} ${r.notes} ${sourceLabel[r.source]} ${formatDate(r.timestamp)}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  if (ascending) shown.reverse();
  const selectedReadings = ordered.filter((r) => selected.has(r.id));

  useEffect(() => {
    if (!initial.error) {
      try {
        if (!localStorage.getItem(STORAGE_KEY))
          saveStore(localStorage, initial.data);
      } catch {
        setStorageError(
          "Browser storage is unavailable. No readings have been persisted. Enable browser storage or export a backup before leaving.",
        );
      }
    }
  }, [initial]);
  useEffect(() => {
    const listener = () => {
      setPage(currentPage());
      setMenu(false);
      setConsent(false);
    };
    addEventListener("hashchange", listener);
    return () => removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    document.title = `BoneVital · ${navigation.find((n) => n.id === page)?.label}`;
  }, [page]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try {
          setData(loadStore(localStorage) ?? emptyStore());
          setSelected(new Set());
          setConsent(false);
        } catch {
          setStorageError(
            "Data changed in another tab but could not be read. Reload after checking your backup.",
          );
        }
      }
    };
    addEventListener("storage", sync);
    return () => removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    // A navigation-only tool. Never exposes readings or bypasses export consent.
    const context = (
      document as Document & {
        modelContext?: {
          registerTool(
            tool: unknown,
            options: { signal: AbortSignal },
          ): Promise<void> | void;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "bonevital_start_reading",
            title: "Open new reading",
            description:
              "Open the BoneVital new-reading form. Does not acquire, save, or expose any health data.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute(input: unknown) {
              if (
                !input ||
                typeof input !== "object" ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw new Error("Expected an empty object.");
              flushSync(() => setPage("reading"));
              location.hash = "reading";
              return { page: "reading", saved: false };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Optional API, normal UI stays available. */
    }
    return () => lifecycle.abort();
  }, []);
  function navigate(next: Page) {
    setPage(next);
    location.hash = next;
    setMenu(false);
    setConsent(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function commit(next: StoreData, message?: string): boolean {
    if (storageError) {
      setToast(
        "Resolve the storage issue before saving. Your existing data is preserved.",
      );
      return false;
    }
    try {
      saveStore(localStorage, next);
      setData(next);
      setConsent(false);
      if (message) setToast(message);
      return true;
    } catch {
      setToast(
        "Could not save. Storage may be full or unavailable. Your input has been kept; export a backup before closing.",
      );
      return false;
    }
  }
  function addReading(reading: Reading) {
    const result = commit(
      { ...data, readings: [...data.readings, reading] },
      "Reading saved to this browser.",
    );
    if (result) {
      setSource(reading.source);
      setSelected(new Set());
    }
    return result;
  }
  function loadDemo() {
    if (data.readings.some((r) => r.source === "demo")) {
      setToast("Demo readings are already loaded.");
      return;
    }
    if (
      commit(
        { ...data, readings: [...data.readings, ...createDemoReadings()] },
        "Nine fictional demo readings loaded.",
      )
    )
      setSource("demo");
  }
  function deleteReading(r: Reading) {
    setConfirmation({
      title: "Delete this reading?",
      text: `The ${formatDate(r.timestamp)} reading will be removed from this browser. This cannot be undone without a backup.`,
      label: "Delete reading",
      run: () => {
        if (
          commit(
            { ...data, readings: data.readings.filter((x) => x.id !== r.id) },
            "Reading deleted.",
          )
        ) {
          setDetail(null);
          setSelected((s) => new Set([...s].filter((id) => id !== r.id)));
        }
      },
    });
  }
  function clearAll() {
    setConfirmation({
      title: "Clear all local data?",
      text: "This deletes all BoneVital readings and resets preferences in this browser. Other sites are not affected. Export a backup first; deleted data cannot be recovered here.",
      label: "Clear all data",
      run: () => {
        try {
          clearStore(localStorage);
          saveStore(localStorage, emptyStore());
          setData(emptyStore());
          setStorageError("");
          setSelected(new Set());
          setConsent(false);
          setToast(
            "All BoneVital readings removed and preferences reset. Restore a backup to recover them.",
          );
        } catch {
          setStorageError(
            "Could not clear or reset browser storage. Check your browser settings.",
          );
        }
      },
    });
  }
  function removeDemo() {
    setConfirmation({
      title: "Remove simulated readings?",
      text: "Only fictional demo records will be deleted. Manual and device readings will stay.",
      label: "Remove demo readings",
      run: () => {
        if (
          commit(
            {
              ...data,
              readings: data.readings.filter((r) => r.source !== "demo"),
            },
            "Simulated readings removed.",
          )
        ) {
          setSelected(new Set());
          setSource("manual");
        }
      },
    });
  }
  function restore(next: StoreData) {
    setConfirmation({
      title: "Replace data with this backup?",
      text: `This backup contains ${next.readings.length} readings. It will replace all ${data.readings.length} current readings and preferences. Back up your current data first.`,
      label: "Restore backup",
      run: () => {
        try {
          saveStore(localStorage, next);
          setData(next);
          setStorageError("");
          setSelected(new Set());
          setConsent(false);
          setSource(
            next.readings.some((r) => r.source === "demo") ? "demo" : "manual",
          );
          setToast("Backup restored locally.");
        } catch {
          setToast("Restore failed. The current view has been preserved.");
        }
      },
    });
  }
  function toggleSelection(id: string) {
    setSelected((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
    setConsent(false);
  }
  function selectAll() {
    setSelected(
      selected.size === ordered.length
        ? new Set()
        : new Set(ordered.map((r) => r.id)),
    );
    setConsent(false);
  }
  function exportCsv() {
    try {
      downloadFile(
        createCsv(selectedReadings, consent),
        "bonevital-selected-results.csv",
        "text/csv;charset=utf-8",
      );
      setToast(
        `${selectedReadings.length} results exported. Nothing was sent to a provider.`,
      );
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  function openReport() {
    try {
      requireConsent(consent);
      if (!selectedReadings.length) throw new Error("Select results first.");
      setReport(true);
    } catch (e) {
      setToast((e as Error).message);
    }
  }

  function resultsTable(rows: Reading[], selection = false) {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {selection && (
                <th className="checkbox-cell">
                  <input
                    type="checkbox"
                    aria-label="Select all readings"
                    checked={
                      ordered.length > 0 && selected.size === ordered.length
                    }
                    onChange={selectAll}
                  />
                </th>
              )}
              <th>Date & time</th>
              <th>
                DPD / creatinine <span>nmol/mmol</span>
              </th>
              <th>Source</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {selection && (
                  <td className="checkbox-cell">
                    <input
                      type="checkbox"
                      aria-label={`Select reading ${formatDate(r.timestamp, true)} ${r.stripId}`}
                      checked={selected.has(r.id)}
                      onChange={() => toggleSelection(r.id)}
                    />
                  </td>
                )}
                <td>
                  <button className="row-link" onClick={() => setDetail(r)}>
                    {formatDate(r.timestamp)}
                    <span>
                      {new Date(r.timestamp).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {r.stripId ? ` · ${r.stripId}` : ""}
                    </span>
                  </button>
                </td>
                <td className="numeric">{formatNumber(r.ratioNmolMmol)}</td>
                <td>
                  <SourceBadge reading={r} />
                </td>
                <td>
                  <StatusBadge reading={r} />
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`View reading ${formatDate(r.timestamp, true)}`}
                    onClick={() => setDetail(r)}
                  >
                    <ChevronRight size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <Empty title="No readings here yet">
            Add a new reading or adjust your filters.
          </Empty>
        )}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Skip to content
      </a>
      {menu && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "is-open" : ""}`}>
        <button
          className="brand"
          onClick={() => navigate("overview")}
          aria-label="BoneVital overview"
        >
          <span className="brand-icon">
            <Activity size={24} strokeWidth={2.4} />
          </span>
          <span>
            BoneVital<small>BONE HEALTH COMPANION</small>
          </span>
        </button>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          <X size={20} />
        </button>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }, i) => (
            <div key={id}>
              {i === 5 && <div className="nav-divider" />}
              <button
                aria-current={page === id ? "page" : undefined}
                className={`nav-item ${page === id ? "active" : ""}`}
                onClick={() => navigate(id)}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{label}</span>
                {id === "reading" && <span className="nav-plus">+</span>}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="reader-card">
            <span className="reader-icon">
              <Usb size={20} />
            </span>
            <div>
              <strong>
                {connection === "disconnected"
                  ? "Reader not connected"
                  : `Reader ${connection}`}
              </strong>
              <p>USB serial connection</p>
            </div>
            <button onClick={() => navigate("reading")}>
              Connect a reader <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="profile">
            <span className="avatar">
              {data.settings.anonymous
                ? "BV"
                : data.settings.displayName.trim().slice(0, 2).toUpperCase() ||
                  "BV"}
            </span>
            <div>
              <strong>
                {data.settings.anonymous
                  ? "Your private workspace"
                  : data.settings.displayName || "Your workspace"}
              </strong>
              <small>Stored on this browser</small>
            </div>
            <button
              className="icon-button"
              onClick={() => navigate("settings")}
              aria-label="Open profile settings"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu icon-button"
              onClick={() => setMenu(true)}
              aria-label="Open navigation"
              aria-expanded={menu}
            >
              <Menu size={23} />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={13} />
              <strong>{navigation.find((n) => n.id === page)?.label}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="prototype-pill">PROTOTYPE</span>
            <span className="local-label">
              <LockKeyhole size={14} />
              Private & local
            </span>
          </div>
        </header>
        <main id="main-content" ref={mainRef} tabIndex={-1}>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === "overview"
                  ? "YOUR OVERVIEW"
                  : navigation.find((n) => n.id === page)?.label.toUpperCase()}
              </span>
              <h1>{titles[page][0]}</h1>
              <p>{titles[page][1]}</p>
            </div>
            {page !== "reading" &&
              page !== "settings" &&
              page !== "science" && (
                <button
                  className="button primary new-reading"
                  onClick={() => navigate("reading")}
                >
                  <Plus size={18} />
                  New reading
                </button>
              )}
          </div>
          {storageError && (
            <Notice tone="error">
              <strong>Storage needs attention.</strong> {storageError}
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                I consent to downloading the stored copy, which may include
                readable health data.
              </label>
              <button
                className="button secondary"
                disabled={!consent}
                onClick={() => {
                  try {
                    requireConsent(consent);
                    downloadFile(
                      localStorage.getItem(STORAGE_KEY) ?? "",
                      "bonevital-storage-recovery.json",
                      "application/json",
                    );
                  } catch {
                    setToast("Browser storage could not be accessed.");
                  }
                }}
              >
                Download stored copy
              </button>
            </Notice>
          )}
          {page === "overview" && (
            <>
              <div className="demo-banner">
                <span className="banner-icon">
                  <FlaskConical size={20} />
                </span>
                <div>
                  <strong>
                    {data.readings.some((r) => r.source === "demo")
                      ? "You’re exploring with demo data"
                      : "Prototype workspace"}
                  </strong>
                  <p>
                    {data.readings.some((r) => r.source === "demo")
                      ? "Simulated readings help you get familiar with BoneVital. They aren’t medical results."
                      : "Add your own readings or load fictional examples to explore the dashboard."}
                  </p>
                </div>
                <button
                  onClick={
                    data.readings.some((r) => r.source === "demo")
                      ? removeDemo
                      : loadDemo
                  }
                >
                  {data.readings.some((r) => r.source === "demo")
                    ? "Clear demo data"
                    : "Load demo data"}
                  <ArrowRight size={16} />
                </button>
              </div>
              <div className="metric-grid">
                <section className="card metric primary-metric">
                  <div className="metric-label">
                    Latest DPD / creatinine
                    <TrendingUp size={18} />
                  </div>
                  <div className="metric-value">
                    {formatNumber(latest?.ratioNmolMmol)}
                    <span>nmol/mmol</span>
                  </div>
                  <div className="metric-footer">
                    {latest ? (
                      <>
                        <SourceBadge reading={latest} />
                        <span>
                          {latest.status === "recorded"
                            ? "Normalized result"
                            : "No usable result"}
                        </span>
                      </>
                    ) : (
                      "No readings yet"
                    )}
                  </div>
                </section>
                <section className="card metric">
                  <div className="metric-label">
                    DPD concentration
                    <Activity size={18} />
                  </div>
                  <div className="metric-value">
                    {formatNumber(latest?.dpdNmolL, 1)}
                    <span>nmol/L</span>
                  </div>
                  <div className="metric-footer">
                    {latest?.status === "no-signal"
                      ? "No signal detected"
                      : latest?.calibration === "demo-inverse-v1"
                        ? "Demonstration conversion"
                        : latest?.source === "manual"
                          ? "Manually entered value"
                          : "Awaiting calibrated data"}
                  </div>
                </section>
                <section className="card metric">
                  <div className="metric-label">
                    Creatinine
                    <FlaskConical size={18} />
                  </div>
                  <div className="metric-value">
                    {formatNumber(latest?.creatinineMmolL, 1)}
                    <span>mmol/L</span>
                  </div>
                  <div className="metric-footer">
                    {latest?.source === "demo"
                      ? "Synthetic sample value"
                      : "Independent sample measurement"}
                  </div>
                </section>
                <section className="card metric">
                  <div className="metric-label">
                    Total readings
                    <ClipboardList size={18} />
                  </div>
                  <div className="metric-value">
                    {data.readings.length}
                    <span>recorded</span>
                  </div>
                  <div className="metric-footer">
                    <span className="small-dot" />
                    {
                      data.readings.filter((r) => r.source === "demo").length
                    }{" "}
                    simulated ·{" "}
                    {data.readings.filter((r) => r.source !== "demo").length}{" "}
                    other
                  </div>
                </section>
              </div>
              {latest && <NoSignal reading={latest} />}
              <div className="dashboard-grid">
                <section className="card chart-card">
                  <div className="section-heading">
                    <div>
                      <h2>Your readings over time</h2>
                      <p>DPD-to-creatinine ratio</p>
                    </div>
                    <span className="chart-key">
                      <span />
                      {sourceLabel[source]}
                    </span>
                  </div>
                  <RangeControls
                    days={days}
                    setDays={setDays}
                    source={source}
                    setSource={setSource}
                  />
                  <TrendChart readings={filtered} compact />
                  <p className="trend-overview">
                    {change === null
                      ? "Add comparable readings to see numeric changes."
                      : `${change > 0 ? "+" : ""}${change.toFixed(1)}% from first to latest available · not a health assessment`}
                  </p>
                  <div className="chart-bottom">
                    <span>
                      <ShieldCheck size={15} />
                      No diagnostic thresholds
                    </span>
                    <TextLink onClick={() => navigate("trends")}>
                      Explore trends
                    </TextLink>
                  </div>
                </section>
                <div className="dashboard-side">
                  <section className="card latest-card">
                    <div className="section-heading">
                      <h2>Latest reading</h2>
                      <span className="round-icon">
                        <Waves size={17} />
                      </span>
                    </div>
                    {latest ? (
                      <>
                        <div className="latest-date">
                          {formatDate(latest.timestamp)}
                          <span>
                            {new Date(latest.timestamp).toLocaleTimeString(
                              undefined,
                              { hour: "numeric", minute: "2-digit" },
                            )}
                          </span>
                        </div>
                        <dl className="summary-list">
                          <div>
                            <dt>Test-strip ID</dt>
                            <dd>{latest.stripId || "Not specified"}</dd>
                          </div>
                          <div>
                            <dt>Source</dt>
                            <dd>
                              <SourceBadge reading={latest} />
                            </dd>
                          </div>
                          <div>
                            <dt>Raw current</dt>
                            <dd>
                              {formatNumber(
                                latest.currentUa === null
                                  ? null
                                  : latest.currentUa *
                                      (data.settings.currentUnit === "nA"
                                        ? 1000
                                        : 1),
                              )}{" "}
                              {data.settings.currentUnit}
                            </dd>
                          </div>
                          <div>
                            <dt>Test status</dt>
                            <dd>
                              <StatusBadge reading={latest} />
                            </dd>
                          </div>
                        </dl>
                        <button
                          className="button secondary full"
                          onClick={() => setDetail(latest)}
                        >
                          View reading details
                          <ArrowRight size={16} />
                        </button>
                      </>
                    ) : (
                      <Empty>Add a reading to see its details here.</Empty>
                    )}
                  </section>
                  <section className="privacy-callout">
                    <ShieldCheck size={25} />
                    <h3>Private by design.</h3>
                    <p>
                      Your readings stay on this browser. You decide what to
                      export and share.
                    </p>
                    <TextLink onClick={() => navigate("settings")}>
                      Your privacy controls
                    </TextLink>
                  </section>
                </div>
              </div>
              <section className="card recent-card">
                <div className="section-heading">
                  <div>
                    <h2>Recent readings</h2>
                    <p>A little context for every test.</p>
                  </div>
                  <TextLink onClick={() => navigate("history")}>
                    View all history
                  </TextLink>
                </div>
                {resultsTable(ordered.slice(0, 3))}
              </section>
            </>
          )}
          {page === "reading" && (
            <ReadingForm
              settings={data.settings}
              adapter={adapter.current}
              connection={connection}
              onSave={addReading}
              onConnectionError={() => {}}
            />
          )}
          {page === "trends" && (
            <>
              <section className="card trends-toolbar">
                <RangeControls
                  days={days}
                  setDays={setDays}
                  source={source}
                  setSource={setSource}
                />
                <div className="trend-stat">
                  <BarChart3 size={20} />
                  <span>
                    <strong>{valid.length}</strong> available results
                  </span>
                  <span>
                    {change === null
                      ? "No comparable change available"
                      : `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs first result in this view`}
                  </span>
                </div>
              </section>
              {source === "demo" && (
                <Notice>
                  These trends are fictional. Changes are numeric comparisons
                  only, not evidence of better or worse bone health.
                </Notice>
              )}
              {source === "manual" && (
                <Notice>
                  Manual current inputs use a demo curve. Direct DPD entries may
                  have a different assay. Compare only compatible methods; no
                  change summary is shown for mixed calibrations.
                </Notice>
              )}
              {source === "device" && (
                <Notice tone="warning">
                  Device current is not converted to DPD without a validated
                  calibration. Raw records are available in History.
                </Notice>
              )}
              <section className="card chart-card">
                <div className="section-heading">
                  <div>
                    <h2>Creatinine-normalized DPD</h2>
                    <p>DPD / creatinine · nmol/mmol</p>
                  </div>
                  <span className="chart-key">
                    <span />
                    {sourceLabel[source]}
                  </span>
                </div>
                <TrendChart readings={filtered} />
              </section>
              <section className="card chart-card">
                <div className="section-heading">
                  <div>
                    <h2>DPD concentration</h2>
                    <p>Before creatinine normalization · nmol/L</p>
                  </div>
                </div>
                <TrendChart readings={filtered} metric="dpdNmolL" />
              </section>
              <p className="small muted">
                Missing or uncalibrated results appear as gaps. The app does not
                carry a previous concentration forward when no new measurement
                is available.
              </p>
            </>
          )}
          {page === "history" && (
            <section className="card">
              <div className="history-toolbar">
                <label className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Search reading history"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search notes, dates, or strip IDs…"
                  />
                </label>
                <div className="history-filters">
                  <select
                    aria-label="Filter reading source"
                    value={historySource}
                    onChange={(e) => setHistorySource(e.target.value)}
                  >
                    <option value="all">All sources</option>
                    <option value="demo">Simulated</option>
                    <option value="manual">Manual entry</option>
                    <option value="device">Device</option>
                  </select>
                  <select
                    aria-label="Filter reading status"
                    value={historyStatus}
                    onChange={(e) => setHistoryStatus(e.target.value)}
                  >
                    <option value="all">All statuses</option>
                    <option value="recorded">Recorded</option>
                    <option value="no-signal">No signal</option>
                    <option value="uncalibrated">Raw data only</option>
                  </select>
                  <button
                    className="button secondary"
                    onClick={() => setAscending(!ascending)}
                  >
                    <SlidersHorizontal size={15} />
                    {ascending ? "Oldest first" : "Newest first"}
                  </button>
                </div>
              </div>
              {resultsTable(shown)}
              <div className="table-footer">
                <span>
                  {shown.length} of {ordered.length} readings
                </span>
                <button
                  className="text-link"
                  onClick={() => navigate("export")}
                >
                  Export selected results
                  <ArrowRight size={16} />
                </button>
              </div>
            </section>
          )}
          {page === "export" && (
            <div className="export-layout">
              <section className="card">
                <div className="section-heading padded">
                  <div>
                    <h2>Choose your results</h2>
                    <p>
                      {selected.size} of {ordered.length} selected
                    </p>
                  </div>
                  <button className="button secondary" onClick={selectAll}>
                    {selected.size === ordered.length && ordered.length
                      ? "Deselect all"
                      : "Select all"}
                  </button>
                </div>
                {resultsTable(ordered, true)}
              </section>
              <aside>
                <section className="card export-panel">
                  <span className="large-icon">
                    <FileDown size={24} />
                  </span>
                  <h2>Ready when you are.</h2>
                  <p className="muted">
                    Export only the readings you select. Simulated and
                    uncalibrated results remain clearly labeled.
                  </p>
                  <label className="checkbox-row consent-box">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    I consent to exporting these selected results. I understand
                    exported files contain readable health data.
                  </label>
                  <button
                    className="button primary full"
                    disabled={!consent || !selectedReadings.length}
                    onClick={exportCsv}
                  >
                    <Download size={17} />
                    Download CSV
                  </button>
                  <button
                    className="button secondary full"
                    disabled={!consent || !selectedReadings.length}
                    onClick={openReport}
                  >
                    <Printer size={17} />
                    Printable provider report
                  </button>
                  <p className="small privacy-note">
                    <LockKeyhole size={16} />
                    Nothing is sent automatically. You choose who receives the
                    exported file.
                  </p>
                </section>
                <Notice>
                  Consult a qualified healthcare professional for medical
                  interpretation. These prototype results do not diagnose
                  osteoporosis.
                </Notice>
              </aside>
            </div>
          )}
          {page === "settings" && (
            <SettingsView
              key={`${data.settings.displayName}-${data.settings.anonymous}-${data.settings.hardwareMode}-${data.settings.currentUnit}`}
              data={data}
              onSettings={(settings: Settings) =>
                commit({ ...data, settings }, "Preferences saved.")
              }
              onRestore={restore}
              onClear={clearAll}
              onClearDemo={removeDemo}
              onDemo={loadDemo}
            />
          )}
          {page === "science" && <ScienceView />}
          <footer className="page-footer">
            <p>
              <ShieldCheck size={14} />
              BoneVital is a prototype for monitoring trends and is not a
              diagnostic device.
            </p>
            <span>Made for MESA U Hacks · 2026</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
          <button
            className="icon-button"
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {detail && (
        <Modal title="Reading details" onClose={() => setDetail(null)}>
          <div className="detail-heading">
            <SourceBadge reading={detail} />
            <StatusBadge reading={detail} />
          </div>
          <p className="muted">{formatDate(detail.timestamp, true)}</p>
          <NoSignal reading={detail} />
          <dl className="detail-list">
            {[
              [
                "DPD / creatinine",
                `${formatNumber(detail.ratioNmolMmol)} nmol/mmol`,
              ],
              ["DPD concentration", `${formatNumber(detail.dpdNmolL)} nmol/L`],
              ["Creatinine", `${formatNumber(detail.creatinineMmolL)} mmol/L`],
              ["Raw current", `${formatNumber(detail.currentUa)} µA`],
              ["Applied voltage", `${formatNumber(detail.voltageV)} V`],
              [
                "Signal detected",
                detail.signalDetected === null
                  ? "Not measured (manual DPD)"
                  : detail.signalDetected
                    ? "Yes"
                    : "No",
              ],
              ["Calibration", detail.calibration],
              ["Test-strip ID", detail.stripId || "Not specified"],
              ["Notes", detail.notes || "No notes"],
              ["Record ID", detail.id],
            ].map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <Notice>
            {detail.calibration === "demo-inverse-v1"
              ? "Uses a fictional calibration. Not a clinical measurement."
              : detail.status === "uncalibrated"
                ? "No validated calibration is configured. DPD and ratio are unavailable."
                : "Record contents are not verified medical results."}
          </Notice>
          <div className="modal-actions">
            <button
              className="button danger"
              onClick={() => {
                const r = detail;
                setDetail(null);
                deleteReading(r);
              }}
            >
              <Trash2 size={16} />
              Delete reading
            </button>
            <button
              className="button secondary"
              onClick={() => setDetail(null)}
            >
              Done
            </button>
          </div>
        </Modal>
      )}
      {confirmation && (
        <Modal title={confirmation.title} onClose={() => setConfirmation(null)}>
          <p>{confirmation.text}</p>
          <div className="modal-actions">
            <button
              className="button secondary"
              autoFocus
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </button>
            <button
              className="button danger"
              onClick={() => {
                const fn = confirmation.run;
                setConfirmation(null);
                fn();
              }}
            >
              {confirmation.label}
            </button>
          </div>
        </Modal>
      )}
      {report && (
        <Modal
          title="Provider report preview"
          onClose={() => setReport(false)}
          wide
        >
          <div className="report">
            <div className="report-heading">
              <h2>BoneVital</h2>
              <span>PROTOTYPE · NOT DIAGNOSTIC</span>
            </div>
            <h3>Selected bone-resorption marker readings</h3>
            <p>
              {data.settings.anonymous
                ? "Anonymous user"
                : data.settings.displayName || "Unnamed user"}{" "}
              · Generated {formatDate(new Date().toISOString(), true)}
            </p>
            <Notice>
              This report includes prototype or manually entered data. Demo
              calibration is unvalidated. No signal means an unavailable
              measurement, not absent DPD. Consult a qualified healthcare
              professional for interpretation.
            </Notice>
            <div className="table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Source / calibration</th>
                    <th>Current µA</th>
                    <th>DPD nmol/L</th>
                    <th>Creatinine mmol/L</th>
                    <th>Ratio nmol/mmol</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReadings.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDate(r.timestamp, true)}</td>
                      <td>
                        {sourceLabel[r.source]}
                        <br />
                        {r.calibration}
                      </td>
                      <td>{formatNumber(r.currentUa)}</td>
                      <td>{formatNumber(r.dpdNmolL)}</td>
                      <td>{formatNumber(r.creatinineMmolL)}</td>
                      <td>{formatNumber(r.ratioNmolMmol)}</td>
                      <td>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedReadings
              .filter((r) => r.notes || r.stripId)
              .map((r) => (
                <p className="report-note" key={r.id}>
                  <strong>
                    {formatDate(r.timestamp)} · {r.stripId || "No strip ID"}
                  </strong>
                  <br />
                  {r.notes || "No notes"}
                </p>
              ))}
            <p className="small">
              Ratio = DPD (nmol/L) ÷ creatinine (mmol/L). Raw data is not a
              diagnosis. Demo current conversion: DPD = 1000/current − 10, valid
              only for fictional 5–100 µA data. No clinical reference intervals
              are supplied.
            </p>
            <p className="small">
              BoneVital is a prototype for monitoring trends and is not a
              diagnostic device.
            </p>
          </div>
          <div className="modal-actions no-print">
            <button
              className="button secondary"
              onClick={() => setReport(false)}
            >
              Close
            </button>
            <button
              className="button primary"
              onClick={() => {
                try {
                  requireConsent(consent);
                  window.print();
                } catch (e) {
                  setToast((e as Error).message);
                }
              }}
            >
              <Printer size={16} />
              Print / save as PDF
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
