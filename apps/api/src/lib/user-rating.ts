/** Recompute cached rating/reviewCount for a user from Review rows. */
export async function refreshUserRating(
  prisma: {
    review: {
      aggregate: (args: {
        where: { subjectId: string };
        _avg: { rating: true };
        _count: { _all: true };
      }) => Promise<{ _avg: { rating: number | null }; _count: { _all: number } }>;
    };
    user: {
      update: (args: {
        where: { id: string };
        data: { rating: number; reviewCount: number };
      }) => Promise<unknown>;
    };
  },
  userId: string,
) {
  const aggregate = await prisma.review.aggregate({
    where: { subjectId: userId },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: {
      rating: aggregate._avg.rating ?? 0,
      reviewCount: aggregate._count._all,
    },
  });
}
