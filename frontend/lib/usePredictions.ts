import useSWR from 'swr';
import type { PredictionGame } from '@/lib/types';

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function formatDateLabel(yyyymmdd: string): string {
  const y = yyyymmdd.slice(0, 4);
  const m = parseInt(yyyymmdd.slice(4, 6));
  const d = parseInt(yyyymmdd.slice(6, 8));
  const date = new Date(parseInt(y), m - 1, d);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${y}년 ${m}월 ${d}일 (${days[date.getDay()]})`;
}

export function usePredictions(date: string) {
  const { data, error, isLoading } = useSWR<PredictionGame[]>(
    date ? `/api/predictions/${date}` : null,
    fetcher,
    {
      refreshInterval: 5 * 60 * 1000,  // 5분 자동 갱신
      revalidateOnFocus: false,
      dedupingInterval: 60 * 1000,
    }
  );

  return {
    games: data ?? [],
    isLoading,
    isError: !!error,
    error,
  };
}
