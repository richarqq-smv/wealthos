import { useEffect, useState } from "react";
import { PortfolioSnapshotRepository } from "@/lib/repositories/PortfolioSnapshotRepository";
import type { PortfolioSnapshot } from "@/types/models";
import { periodStartDate, type PeriodKey } from "@/utils/date";

export function usePortfolioSnapshots() {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    PortfolioSnapshotRepository.getSorted().then((data) => {
      if (mounted) {
        setSnapshots(data);
        setIsLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return { snapshots, isLoading };
}

export function filterSnapshotsByPeriod(
  snapshots: PortfolioSnapshot[],
  period: PeriodKey
): PortfolioSnapshot[] {
  const start = periodStartDate(period);
  if (!start) return snapshots;
  return snapshots.filter((s) => new Date(s.date).getTime() >= start.getTime());
}
