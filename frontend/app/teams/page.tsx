'use client';

import Link from 'next/link';
import { useStandings } from '@/lib/usePredictions';
import { TEAM_COLOR } from '@/lib/types';
import { BottomNav } from '@/app/page';

// ── 최근 10경기 폼 시각화 ─────────────────────────────────────────────────────

function FormDots({ recent10 }: { recent10: string }) {
  if (!recent10) return null;
  const chars = recent10.replace(/\s/g, '').split('');
  return (
    <div className="flex gap-0.5">
      {chars.slice(-10).map((c, i) => {
        const isWin = c === '승' || c === 'W' || c === '1';
        const isLoss = c === '패' || c === 'L' || c === '0';
        return (
          <span
            key={i}
            className={`w-2 h-2 rounded-full ${
              isWin ? 'bg-blue-500' : isLoss ? 'bg-red-400' : 'bg-gray-300'
            }`}
          />
        );
      })}
    </div>
  );
}

// ── 팀 순위 행 ────────────────────────────────────────────────────────────────

function StandingRow({
  standing,
  isTop3,
}: {
  standing: { rank: number; team: string; games: number; wins: number; losses: number; draws: number; win_pct: number; gb: string; recent10: string; streak: string };
  isTop3: boolean;
}) {
  const color = TEAM_COLOR[standing.team] ?? '#555';

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${
        isTop3 ? 'bg-white' : 'bg-white'
      } border-b border-gray-50 last:border-0`}
    >
      {/* 순위 */}
      <div className="w-6 flex-shrink-0">
        {standing.rank <= 3 ? (
          <span className={`text-sm font-black ${
            standing.rank === 1 ? 'text-yellow-500' :
            standing.rank === 2 ? 'text-gray-400' :
            'text-orange-400'
          }`}>
            {standing.rank === 1 ? '🥇' : standing.rank === 2 ? '🥈' : '🥉'}
          </span>
        ) : (
          <span className="text-sm font-bold text-gray-400 text-center block">{standing.rank}</span>
        )}
      </div>

      {/* 팀 */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-black flex-shrink-0"
          style={{ backgroundColor: color }}
        >
          {standing.team.slice(0, 2)}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm text-gray-900 leading-none">{standing.team}</p>
          <FormDots recent10={standing.recent10} />
        </div>
      </div>

      {/* 전적 */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-gray-800">
          {standing.wins}승 {standing.losses}패{standing.draws > 0 ? ` ${standing.draws}무` : ''}
        </p>
        <p className="text-[11px] text-gray-400">
          {(standing.win_pct * 100).toFixed(1)}%
          {standing.gb !== '-' && standing.gb !== '0' && ` · GB ${standing.gb}`}
        </p>
      </div>
    </div>
  );
}

// ── 팀 순위 페이지 ────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const { standings, isLoading, isError } = useStandings();

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-20">
      {/* 헤더 */}
      <header className="bg-[#1e3a6e] text-white px-4 py-4 shadow-md">
        <h1 className="font-black text-xl tracking-tight">팀 순위</h1>
        <p className="text-white/50 text-[11px] mt-0.5">2026 KBO 시즌</p>
      </header>

      <div className="max-w-2xl mx-auto px-3 py-4">
        {isLoading && (
          <div className="flex flex-col items-center py-16 gap-3 text-gray-400">
            <div className="w-7 h-7 border-2 border-[#1e3a6e] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">순위 불러오는 중...</p>
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center py-12 gap-2 text-gray-400">
            <p className="text-red-500 text-sm font-semibold">⚠ 순위 로드 실패</p>
            <p className="text-xs">백엔드 서버를 확인하세요</p>
          </div>
        )}

        {!isLoading && !isError && standings.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3 text-gray-400">
            <div className="text-4xl">🏆</div>
            <p className="text-sm font-medium text-gray-500">순위 데이터 없음</p>
            <p className="text-xs text-center">KBO 공식 데이터가 없습니다</p>
          </div>
        )}

        {!isLoading && !isError && standings.length > 0 && (
          <>
            {/* 헤더 행 */}
            <div className="flex items-center gap-3 px-4 py-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
              <div className="w-6">순위</div>
              <div className="flex-1">팀</div>
              <div className="text-right">전적 / 승률</div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {standings.map((s) => (
                <StandingRow key={s.rank} standing={s} isTop3={s.rank <= 3} />
              ))}
            </div>

            {/* 범례 */}
            <div className="flex items-center gap-4 px-2 mt-3">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <span className="w-2 h-2 rounded-full bg-blue-500" />승리
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <span className="w-2 h-2 rounded-full bg-red-400" />패배
              </div>
              <span className="text-[11px] text-gray-400">최근 10경기 폼</span>
            </div>
          </>
        )}
      </div>

      <BottomNav active="teams" />
    </div>
  );
}
