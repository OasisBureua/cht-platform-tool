/**
 * Shared print/screen chart heights so sparse data (e.g. 1 response)
 * does not leave oversized empty rings / tall empty trend areas.
 * Counts only — does not change analytics values.
 */

export function choicePieHeightPx(nonZeroSliceCount: number): number {
  if (nonZeroSliceCount <= 1) return 140;
  if (nonZeroSliceCount <= 3) return 180;
  return 220;
}

export function submissionsTrendHeightPx(pointCount: number): number {
  if (pointCount <= 2) return 120;
  if (pointCount <= 5) return 148;
  return 176;
}

export function ratingHistogramHeightPx(nonZeroBucketCount: number): number {
  if (nonZeroBucketCount <= 1) return 120;
  if (nonZeroBucketCount <= 3) return 148;
  return 176;
}
