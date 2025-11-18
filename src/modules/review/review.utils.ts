import { ReviewSummaryDto } from './dto/review-response.dto';

export const RATING_SCALE = [1, 2, 3, 4, 5] as const;

// buildRatingBreakdown normalizes counts into a 1-5 map
export const buildRatingBreakdown = (
  counts: Partial<Record<number, number>>,
): Record<number, number> => {
  return RATING_SCALE.reduce<Record<number, number>>((acc, score) => {
    acc[score] = Number(counts[score] ?? 0);
    return acc;
  }, {});
};

// buildReviewSummary derives aggregate stats from rating counts
export const buildReviewSummary = (
  counts: Record<number, number>,
): ReviewSummaryDto => {
  const reviewCount = Object.values(counts).reduce(
    (total, current) => total + current,
    0,
  );

  const weightedSum = RATING_SCALE.reduce((total, score) => {
    return total + score * (counts[score] ?? 0);
  }, 0);

  const averageRating =
    reviewCount === 0 ? 0 : Number((weightedSum / reviewCount).toFixed(2));

  return {
    averageRating,
    reviewCount,
    ratingBreakdown: counts,
  };
};
