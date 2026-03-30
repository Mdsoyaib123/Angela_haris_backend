export class MonthlyUserStatsDto {
  month: string;
  monthNumber: number;
  newUsers: number;
}

export class DashboardStatsDto {
  totalUsers: {
    count: number;
    percentageChange: number;
  };
  activeAthletes: {
    count: number;
    percentageChange: number;
  };
  videoUploads: {
    count: number;
    percentageChange: number;
  };
  totalviews: {
    count: number;
    percentageChange: number;
  };
  currentYearStats: {
    year: number;
    totalNewUsers: number;
    monthlyStats: MonthlyUserStatsDto[];
  };
}
