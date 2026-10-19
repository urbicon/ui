/**
 * A formatter for a share on a 0–100 scale, with exactly `fractionDigits` digits: the locale
 * places the sign and any space before it (`57.7%` in `en`, `57,7 %` with a no-break space in
 * `de`).
 *
 * `unit: 'percent'` formats the 0–100 value as it is. `style: 'percent'` would need
 * `value / 100`, and that division lands half-way values on the other side of the rounding
 * boundary:
 * `new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 1 }).format(0.35 / 100)`
 * is `0.3%`.
 */
export function percentFormatter(
  locale: string,
  fractionDigits: number
): (percent: number) => string {
  const nf = new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
  return (percent) => nf.format(percent);
}
