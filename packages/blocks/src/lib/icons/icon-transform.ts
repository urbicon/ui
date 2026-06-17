/** Build the SVG `transform` attribute for icon rotate/flip. Pure; no icon deps. */
export function buildSvgTransform(
  rotate?: 0 | 90 | 180 | 270,
  flip?: 'x' | 'y' | 'both'
): string | undefined {
  const transforms: string[] = [];
  if (flip === 'x') transforms.push('translate(24 0) scale(-1 1)');
  else if (flip === 'y') transforms.push('translate(0 24) scale(1 -1)');
  else if (flip === 'both') transforms.push('translate(24 24) scale(-1 -1)');
  if (rotate) transforms.push(`rotate(${rotate} 12 12)`);
  return transforms.length ? transforms.join(' ') : undefined;
}
