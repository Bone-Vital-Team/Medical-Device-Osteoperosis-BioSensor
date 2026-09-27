import {
  Activity,
  Beaker,
  CircleHelp,
  Cpu,
  FlaskConical,
  Scale,
  TrendingUp,
} from "lucide-react";
import { Notice } from "./UI";
export function ScienceView() {
  return (
    <div className="science">
      <section className="card science-intro">
        <div className="large-icon">
          <FlaskConical size={27} />
        </div>
        <div>
          <span className="section-kicker">THE BONEVITAL CONCEPT</span>
          <h2>From a test strip to a trend</h2>
          <p>
            Our proposed biosensor explores urinary deoxypyridinoline (DPD), a
            bone-resorption marker, relative to creatinine. This prototype
            demonstrates the software workflow—not a clinically validated assay.
          </p>
        </div>
      </section>
      <div className="science-steps">
        {[
          [
            Beaker,
            "01",
            "The disposable strip",
            "The proposed strip has a working electrode coated with DPD antibodies, an Ag/AgCl reference electrode, and a counter electrode. Together they support electrochemical measurement.",
          ],
          [
            FlaskConical,
            "02",
            "A competitive reaction",
            "In the proposed assay, urinary DPD competes with enzyme-labeled DPD analogs. More DPD means fewer labeled analogs bind, producing a lower enzymatic electrochemical signal.",
          ],
          [
            Cpu,
            "03",
            "The handheld reader",
            "A potentiostat controls electrode potential and measures amperometric current. A microcontroller can send raw readings to the browser. The browser does not replace the potentiostat.",
          ],
          [
            Activity,
            "04",
            "A calibration step",
            "Converting current to DPD requires an assay-specific calibration. The simulator uses a fictional inverse curve. Actual device readings remain raw until a validated calibration is implemented.",
          ],
          [
            Scale,
            "05",
            "Creatinine normalization",
            "Divide DPD in nmol/L by independently measured creatinine in mmol/L from the same urine sample. The resulting ratio is nmol/mmol. DPD current alone cannot determine creatinine.",
          ],
          [
            TrendingUp,
            "06",
            "Trends with context",
            "View repeated readings and export them for discussion with a qualified healthcare professional. Demo trends, manual entries, and device measurements are kept distinguishable.",
          ],
        ].map(([Icon, number, title, text]) => {
          const I = Icon as typeof Beaker;
          return (
            <section className="card science-step" key={String(number)}>
              <div className="step-top">
                <I size={23} />
                <span>{String(number)}</span>
              </div>
              <h3>{String(title)}</h3>
              <p>{String(text)}</p>
            </section>
          );
        })}
      </div>
      <section className="card form-card">
        <h2>Know what the numbers mean</h2>
        <Notice tone="warning">
          No signal is not the same as no DPD. A missing signal may reflect a
          connection issue, an invalid test, or an assay-limit problem.
          BoneVital leaves DPD and ratio values unavailable for these readings.
        </Notice>
        <div className="science-columns">
          <div>
            <h3>Demonstration curve</h3>
            <code className="formula-code">DPD = 1000 / current − 10</code>
            <p>
              Current is in µA, DPD in nmol/L. The illustrative range is 5–100
              µA; these constants are invented for the software demonstration.
              They are not calibration data or reference intervals.
            </p>
          </div>
          <div>
            <h3>No diagnostic categories</h3>
            <p>
              The application does not label values as healthy, high-risk,
              osteopenia, or osteoporosis. A “Recorded” status confirms a
              complete software record, not clinical validity. Green is an
              interface status, not a health assessment.
            </p>
          </div>
        </div>
        <p className="source-links">
          <CircleHelp size={16} />
          <a
            href="https://www.mayocliniclabs.com/test-catalog/overview/58048"
            target="_blank"
            rel="noreferrer"
          >
            DPD laboratory test information
          </a>
          <a
            href="https://developer.chrome.com/docs/capabilities/serial"
            target="_blank"
            rel="noreferrer"
          >
            Web Serial integration guide
          </a>
        </p>
      </section>
    </div>
  );
}
