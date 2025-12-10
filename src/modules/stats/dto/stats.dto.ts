export class OverviewStatsDto {
  totalProgrammes: number;
  publishedProgrammes: number;
  draftProgrammes: number;
  featuredProgrammes: number;
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  reviewsThisWeek: number;
  totalPreOrders: number;
  userGrowth: { date: string; count: number }[];
}

export class ProgrammeStatsDto {
  totalProgrammes: number;
  publishedProgrammes: number;
  draftProgrammes: number;
  featuredProgrammes: number;
}
