/**
 * 上下1つずつを外れ値として除外したあとの中央値を返す。
 * 配列が0なら 0、1〜2件ならそのまま中央値。
 */
export function trimmedMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length <= 2) {
    const mid = Math.floor(sorted.length / 2);
    return sorted[mid] ?? 0;
  }
  const trimmed = sorted.slice(1, -1);
  const m = Math.floor(trimmed.length / 2);
  if (trimmed.length % 2 === 0) {
    return (trimmed[m - 1]! + trimmed[m]!) / 2;
  }
  return trimmed[m]!;
}
