# BoneVital

BoneVital is a working, local-first web prototype for exploring urinary DPD and creatinine-normalized bone-resorption marker trends. It is built for the MESA U Hacks concept: a disposable competitive-immunoassay strip plus a handheld potentiostat reader.

**Not a diagnostic device.** No clinical calibration, diagnostic thresholds, clinical validation, regulatory clearance, or HIPAA compliance is claimed. Consult a qualified healthcare professional for medical interpretation. Use fictional data for the hackathon.

## Start on your computer

Install Node.js 22.12 or later (Node 22 or 24 LTS recommended). Extract the source ZIP and open a terminal in its `bonevital` folder.

```sh
npm install
npm run dev
```

Open the localhost address printed by Vite (normally `http://localhost:4173`). Do not double-click `index.html`; the source requires Vite. No API keys, database, paid APIs, accounts, or environment variables are needed.

```sh
npm test          # automated tests
npm run build    # TypeScript checks and production build
npm run preview  # serve the production build locally
```

Use `npm ci` instead of `npm install` for exact lockfile reproduction. Dependencies are locked in `package-lock.json`.

## Try the demo

1. On first use, the app loads nine clearly labeled fictional readings. Clear them with **Clear demo data**, or reload them in **Settings & privacy → Load demo readings**.
2. Open **New reading → Simulated → Generate simulated reading**. The app provides a synthetic raw current and creatinine value.
3. Review the result, optionally add a strip ID or notes, and select **Save result**. The record is now in History and persists through a browser reload.
4. Repeat with **Simulate no electrical signal** selected. Save the event. The app retains raw signal status but leaves DPD and ratio unavailable, with a flat raw-signal illustration.
5. Use **Manual input** to enter either current or an independently measured DPD concentration. Enter creatinine in mmol/L from the same sample. Current conversion still uses the demo curve and is explicitly labeled.
6. In **Trends**, choose a source and 7/30/90-day or all-time range. Missing measurements create gaps. Curves from different calibration methods are not connected. Change summaries never mix calibration methods.
7. In **Export & sharing**, select records, check the consent box, and download CSV or preview a printable report. Use your browser's Print → Save as PDF for a PDF copy.
8. In **Settings & privacy**, create a JSON backup. Encryption is on by default; use a passphrase of at least 12 characters. Restore validates the whole file and asks before replacing data.

## Features and boundaries

| Section            | Functional behavior                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Overview           | Latest ratio, DPD, creatinine, record count, chart, device state, latest record and recent history                    |
| New reading        | Simulator, no-signal mode, manual DPD/current, Web Serial acquisition, validation, persistent saves                   |
| Trends             | Separate source views, two charts, four date filters, exact-value tooltips and method-aware summaries                 |
| History            | Search date/notes/strip ID, source and status filters, date sort, record details, confirmed deletion                  |
| Export & sharing   | Per-record selection, consent enforcement, escaped CSV, printable provider report                                     |
| Settings & privacy | Anonymous mode, name, µA/nA display, default input mode, encrypted/plain JSON backups, confirmed restore and deletion |
| How it works       | Proposed strip, reader, assay mechanism, calibration, normalization, and limitations                                  |

“Recorded” means a software record was successfully created, not that it is clinically valid. Simulated, manual, and device sources remain labeled in charts, tables, reports, and exports. There are no risk categories or medical reference intervals.

## Calculations and units

Canonical stored/exported units are current **µA**, applied potential **V**, DPD **nmol/L**, creatinine **mmol/L**, and ratio **nmol/mmol**. Changing current display to nA multiplies the displayed number by 1000; it does not relabel unchanged values. Exports remain in canonical units. Creatinine is **not** “creatine.”

```text
DPD / creatinine ratio (nmol/mmol)
    = DPD concentration (nmol/L) / creatinine concentration (mmol/L)

Fictional demonstration curve only:
DPD (nmol/L) = 1000 / current (µA) - 10
Illustrative current range: 5–100 µA
```

The inverse curve only illustrates the competitive-assay direction. Its constants and usable range are invented for demonstration; it is not a substitute for assay calibration. Zero or out-of-range demo current is rejected unless explicitly recorded as a no-signal event. Creatinine must be finite and positive; it cannot be inferred from the DPD current channel.

**Actual device readings do not use this demonstration curve.** They receive `uncalibrated` status with null DPD and ratio. A missing electrical signal is an unavailable measurement, not a claim of absent DPD. Do not draw a flat concentration line or impute a previous concentration when no result exists.

To add real conversion, replace the demonstration-only design with an independently validated assay calibration in `src/lib/calibration.ts`, including range, blank/baseline handling, quality checks, lot/calibration version, uncertainty and expiry. Intentionally update the device safety gate in `createReading`, schema, charts, tests, and explanations. Do not simply turn on the demo curve for patient data.

## Connect a real potentiostat later

A breadboard cannot run the web app or send measurements by itself. A potentiostat, ADC/microcontroller, appropriate electrical interface, and firmware are required. This repository does not include board-specific firmware or a validated assay, because the actual device, pins, electronics, timing and protocol have not been supplied. A temperature sensor is not a DPD/current sensor.

1. Use a reader/microcontroller that exposes USB serial and is safe to connect to the computer. Install the manufacturer's drivers if needed.
2. Configure its firmware to emit the example protocol below, or modify `parseDeviceFrame` and `WebSerialAdapter` in `src/lib/hardware.ts` to match its documented protocol. Default example baud rate: **115200**.
3. Serve BoneVital on HTTPS or localhost. Use a supported desktop Chromium browser. Feature detection provides a clear fallback on unsupported browsers/mobile devices; USB device functionality is not universal.
4. Choose **New reading → Device → Connect reader**, and grant access to the specific device in the browser's chooser.
5. Select **Capture device reading**. A complete JSON line must arrive within 10 seconds. Raw data is displayed for review and only saved when you choose Save result.
6. Enter independently measured creatinine if available, plus notes/strip ID. DPD and ratio remain unavailable until assay calibration has been validated and integrated.

Example **one JSON object per line**, terminated by a newline:

```json
{
  "protocol": "bonevital-v1",
  "current_uA": 18.5,
  "voltage_V": 0.3,
  "signal_detected": true
}
```

No-signal example:

```json
{
  "protocol": "bonevital-v1",
  "current_uA": 0,
  "voltage_V": 0.3,
  "signal_detected": false
}
```

`voltage_V` is optional; `protocol`, numeric `current_uA`, and boolean `signal_detected` are required. The signal flag must come from your device/assay quality logic; the sample app cannot establish the detection limit. Frames over 64 KB and malformed fields are rejected. The read operation waits for one complete line. Disconnect and reconnect after a stream/protocol error.

The adapter is read-only: it **does not send commands, set electrode voltage, start a chemical assay, or program the microcontroller**. Implement device control only after verifying the actual reader protocol and electrical safety. No physical hardware was available for end-to-end testing.

## Privacy and security

- No health data is sent to an external server by this application. The code contains no health-data network API, analytics, advertising, tracking, automatic sharing, or remote font service.
- All records use the localStorage key `bonevital:v1` in the current browser profile and origin. They do not sync across computers, origins or browsers, and are not stored in this Git repository.
- Local storage is **not encrypted** and is not an authenticated medical record system. Another person with browser-profile access, a malicious extension, or injected script could access it. Browser clearing/eviction or device loss may erase it.
- CSV and printable reports contain readable data. Explicit consent is required; selecting different records resets consent. Only the selected records are exported. No email or provider integration is present.
- Backups default to AES-256-GCM with a random 16-byte salt and 12-byte IV, using PBKDF2-SHA256 with 310,000 iterations and a passphrase-derived key. Encryption requires HTTPS or localhost. Passphrases are not persisted and cannot be recovered. These are prototype protections, not a security certification.
- Restore accepts only the supported schema/units, finite numbers, unique IDs and consistent calculated values. Imports are limited to 10 MB / 10,000 readings. Values render as text, not HTML. CSV cells are escaped and spreadsheet formula prefixes are neutralized.
- The production app is static. A host may still process normal visits/IP metadata or require a separate login; no claim is made that hosting generates no logs. External documentation links send you to other sites only when you click them, with a no-referrer policy.
- `_headers` and `vercel.json` provide a production CSP that disables script-initiated network connections, plus referrer, content-type and device permissions headers where the host supports them. GitHub Pages does not apply `_headers`; maintain a trusted repository and avoid adding trackers. Development uses Vite's local hot-reload connection and is not the production privacy boundary.
- A feature-detected WebMCP navigation tool only opens the reading form. It never returns health data, records a measurement, exports data, or bypasses consent. Normal UI works without this optional API.

## Upload your source to GitHub

The source ZIP includes all required application files and the dependency lockfile, but not `node_modules`, compiled output, runtime credentials, the hosting project's identity, test records, or any real health data.

### Easiest method

1. Extract `bonevital-source.zip`.
2. Create a GitHub repository named `bonevital` (choose visibility with your team).
3. Use **Add file → Upload files** and upload the **contents** of the `bonevital` folder, not the ZIP and not an extra enclosing folder. Preserve `.github`, `.gitignore`, and `.env.example` if your file browser hides dotfiles.
4. Commit the files. The CI workflow will run the tests and build.

### Command-line method

Create an empty repository on GitHub without initializing a README. In your extracted project folder:

```sh
git init
git add .
git commit -m "Build BoneVital prototype"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/bonevital.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. Authenticate using GitHub's normal flow; do not put tokens in code. This task does **not** automatically publish to your personal GitHub account. Do not upload downloaded health-data CSV, reports or backup files. Your team should choose a license before offering the project under an open-source license; no license grant is assumed here.

## Deploy from your repository

All app navigation uses URL hashes, so no server routing/SPA rewrite is needed. Vite uses relative asset paths (`base: './'`), including for GitHub project subpaths.

### GitHub Pages

1. In the repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
2. Open **Actions → Deploy to GitHub Pages → Run workflow**.
3. The included `pages.yml` installs locked dependencies, tests, builds, and publishes `dist`.
4. Follow the deployment URL shown by GitHub. Pages availability depends on your repository visibility and GitHub plan. Deployment is manual to avoid unintentionally publishing on the first commit.

### Netlify

Import the GitHub repository. The included `netlify.toml` selects Node 22, runs `npm run build`, and publishes `dist`. Keep HTTPS on. No backend or secrets are needed.

### Vercel

Import the repository, select the Vite preset, and use Node 22 or later. The included `vercel.json` sets the build command, output directory and security headers. No serverless functions are needed.

Neither deployment configuration has been run against your personal GitHub/Netlify/Vercel account. Those integrations require your account choices and authorization. If you publish publicly, people can view the app and its bundled client code, but the app does not upload one visitor's readings for other visitors to see.

## Complete project structure

```text
bonevital/
  .github/workflows/
    ci.yml
    pages.yml
  .env.example
  .gitignore
  README.md
  VERIFICATION.md
  index.html
  package.json
  package-lock.json
  tsconfig.json
  vite.config.ts
  vitest.config.ts
  netlify.toml
  vercel.json
  public/
    favicon.svg
    _headers
  src/
    main.tsx
    App.tsx
    styles.css
    components/
      UI.tsx
      TrendChart.tsx
      ReadingForm.tsx
      SettingsView.tsx
      ScienceView.tsx
    lib/
      model.ts
      calibration.ts
      readings.ts
      storage.ts
      export.ts
      backup.ts
      hardware.ts
      core.test.ts
```

Tailwind v4 is configured through `@tailwindcss/vite` in `vite.config.ts` and CSS-first `@theme` tokens in `src/styles.css`; a legacy `tailwind.config.js` is not required. The Sites working checkout may also have a platform-owned `.openai/hosting.json`; it is excluded from the portable ZIP.

## Testing and verification

`npm test` covers the inverse demo calibration; normalization and bad inputs; no-signal and uncalibrated device records; source labels and unique IDs; local persistence and corruption/quota errors; schema, unit and duplicate validation; CSV selection, escaping and formula defense; consent enforcement; encryption round-trips, wrong passphrases and unsupported imports; and example device-frame parsing.

The application builds using `npm run build`. UI checks and exact test results from this delivery are recorded in `VERIFICATION.md`. A passing build is not clinical, hardware, security or regulatory validation.

## Limitations and next steps

1. Validate the electrochemical assay and calibration with qualified specialists before deriving health measurements from physical hardware.
2. Specify the exact potentiostat/microcontroller and develop its firmware, protocol, timing, disconnection events and electrical safety controls.
3. Implement and validate an independent creatinine measurement pathway and assay quality-control process.
4. Add calibration/strip-lot versioning and an immutable audit trail before any clinical research use.
5. Perform dedicated accessibility testing with target users and assistive technologies, and broader browser/mobile testing.
6. Commission security/privacy review before real health-data use. A future encrypted account-based system would require a deliberately designed backend and compliance review; it is not part of this local-only prototype.
7. Large datasets currently render in one table. Add pagination/virtualization if needed. There is no background sync, offline service worker, automated doctor sharing, diagnostic model, temperature-sensor conversion, or app-controlled electrode voltage.

## Technical references

- [Chrome Web Serial documentation](https://developer.chrome.com/docs/capabilities/serial)
- [Web Serial specification](https://serial.spec.whatwg.org/)
- [Mayo Clinic Laboratories urinary DPD test information](https://www.mayocliniclabs.com/test-catalog/overview/58048)
- [Vite build and deployment guidance](https://vite.dev/guide/static-deploy.html)

The strip/reader design is based on the team's supplied BoneVital project brief. External laboratory references do not validate this proposed sensor or the demonstration formula.
