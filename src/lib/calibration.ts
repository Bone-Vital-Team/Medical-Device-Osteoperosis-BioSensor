/** Fictional competitive-assay curve. NOT a laboratory or clinical calibration.
 * DPD [nmol/L] = 1000 / current [µA] - 10. Valid only for demo current 5–100 µA.
 * A validated device calibration must be supplied separately. Never extrapolate.
 */
export function demoCurrentToDpd(currentUa: number): number {
  if (!Number.isFinite(currentUa) || currentUa < 5 || currentUa > 100) {
    throw new Error(
      "Demo current must be between 5 and 100 µA. This range is illustrative, not a device specification.",
    );
  }
  return 1000 / currentUa - 10;
}
export function demoDpdToCurrent(dpd: number): number {
  if (!Number.isFinite(dpd) || dpd < 0 || dpd > 190)
    throw new Error("Demo DPD must be between 0 and 190 nmol/L.");
  return 1000 / (dpd + 10);
}
export function normalizeDpd(
  dpdNmolL: number,
  creatinineMmolL: number,
): number {
  if (!Number.isFinite(dpdNmolL) || dpdNmolL < 0)
    throw new Error("DPD must be a finite, nonnegative value.");
  if (!Number.isFinite(creatinineMmolL) || creatinineMmolL <= 0)
    throw new Error("Creatinine must be greater than zero in mmol/L.");
  const result = dpdNmolL / creatinineMmolL;
  if (!Number.isFinite(result))
    throw new Error(
      "The normalized value is outside the supported numeric range.",
    );
  return result;
}
