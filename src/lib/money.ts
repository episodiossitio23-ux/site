export function parseReaisToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

export function centsToReaisInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}
