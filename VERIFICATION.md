# BoneVital verification

## Automated checks

- `npm test`: 62 tests passed, covering demo calibration, normalization, invalid or missing input, no-signal records, real-device calibration gating, storage, schema validation, CSV exports, consent, encryption, and transport parsing.
- `npm run build`: TypeScript checks and Vite production build passed.
- `npm audit --audit-level=high`: zero known vulnerabilities at the time checked, including development dependencies. This is not a security certification.
- Source inspection found no `fetch`, `XMLHttpRequest`, `sendBeacon`, or `WebSocket` calls in application source. No health-data backend is present.

## Browser checks completed

- Desktop dashboard renders the initial nine fictional readings, source labels, metrics, history and Recharts plot.
- Simulated acquisition fills current, applied voltage and synthetic creatinine; saving records the result.
- No-signal simulation records the event with unavailable DPD and ratio and a neutral explanation.
- Manual DPD 51 nmol/L with creatinine 8.5 mmol/L produces 6.00 nmol/mmol and saves successfully.
- Saved results survive page reload and remain visible in a second app view.
- Selected-result export buttons stay disabled without consent and become enabled after consent. Changing selection resets consent.
- Browser-generated CSV files were downloaded and inspected. The single-selected-result export contained one row; an all-selected export included the no-signal event with blank concentration and ratio cells.
- Provider-report preview shows selected records, provenance, units, assay limitations, and notes.
- A 390 × 844 CSS viewport was inspected in a temporary same-origin iframe. Navigation works, cards reflow, and the main content has no horizontal overflow. Wide data tables intentionally scroll internally. The test harness is not included in the product.
- Dialogs and controls use semantic HTML, labels and visible focus styles. Mobile-hidden navigation is removed from visibility.

## Not verified

- No physical potentiostat, microcontroller, test strip, assay chemistry, or real sample was connected. The example serial protocol must be matched to the team's actual firmware.
- No clinical calibration or clinical accuracy has been established. The app intentionally leaves real-device DPD and ratio unavailable.
- Encryption round trips and failure paths were tested programmatically. The internal HTTP browser preview cannot exercise Web Crypto or Web Serial as secure-context features; these require HTTPS or localhost.
- The printable report preview was inspected; actual printer output, all PDF drivers, all browsers, screen readers, and physical mobile devices were not exhaustively tested.
- Optional WebMCP navigation-tool validation was unavailable through the permitted browser interface. It is feature-detected and does not expose readings or bypass consent.
- GitHub Pages, Netlify, and Vercel configurations are included, but have not been deployed through the user's personal accounts.

The hosted demonstration and the ZIP contain application code and synthetic fixtures only. Browser-created QA records are not committed, packaged, or uploaded with the source.
