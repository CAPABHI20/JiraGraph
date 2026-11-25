export function batchWithOverlap<T>(arr: T[], size: number, overlap: number): T[][] {
  if (arr.length === 0) return [];
  const batches: T[][] = [];
  let i = 0;
  while (i < arr.length) {
    batches.push(arr.slice(i, i + size));
    i += size - overlap;
  }
  return batches;
}
