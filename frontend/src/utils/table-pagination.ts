/** Page numbers plus ellipsis markers for compact pagination UI. */
export function buildPaginationRange(
  currentPage: number,
  totalPages: number,
  siblingCount = 1,
): Array<number | 'ellipsis'> {
  if (totalPages <= 1) return totalPages === 1 ? [1] : [];

  const totalNumbers = siblingCount * 2 + 5;
  if (totalPages <= totalNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(currentPage - siblingCount, 1);
  const rightSibling = Math.min(currentPage + siblingCount, totalPages);

  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftCount = 3 + siblingCount * 2;
    return [
      ...Array.from({ length: leftCount }, (_, i) => i + 1),
      'ellipsis',
      totalPages,
    ];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightCount = 3 + siblingCount * 2;
    return [
      1,
      'ellipsis',
      ...Array.from(
        { length: rightCount },
        (_, i) => totalPages - rightCount + i + 1,
      ),
    ];
  }

  return [
    1,
    'ellipsis',
    ...Array.from(
      { length: rightSibling - leftSibling + 1 },
      (_, i) => leftSibling + i,
    ),
    'ellipsis',
    totalPages,
  ];
}
