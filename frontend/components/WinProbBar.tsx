'use client';

import { LiveGame, TEAM_COLOR } from '@/lib/types';

interface Props {
  game: LiveGame;
}

export function WinProbBar({ game }: Props) {
  const homeWP  = Math.max(1, Math.min(99, game.homeWP));
  const awayWP  = 100 - homeWP;
  const homeClr = TEAM_COLOR[game.home]  ?? '#1e3a6e';
  const awayClr = TEAM_COLOR[game.away] ?? '#888';

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
        승리 확률
      </p>

      {/* 팀명 + 수치 */}
      <div className="flex justify-between items-end mb-2">
        <div className="flex flex-col items-start">
          <span className="text-xs font-bold" style={{ color: awayClr }}>{game.away}</span>
          <span className="text-2xl font-black text-gray-800">{awayWP}%</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs font-bold" style={{ color: homeClr }}>{game.home}</span>
          <span className="text-2xl font-black text-gray-800">{homeWP}%</span>
        </div>
      </div>

      {/* 바 */}
      <div className="h-3 rounded-full overflow-hidden flex">
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${awayWP}%`, backgroundColor: awayClr, opacity: 0.85 }}
        />
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${homeWP}%`, backgroundColor: homeClr }}
        />
      </div>

      {/* WP 히스토리 */}
      {game.wpaHistory.length > 1 && (
        <div className="mt-3">
          <p className="text-[10px] text-gray-400 mb-1">{game.home} WP 추이</p>
          <div className="flex items-end gap-0.5 h-8">
            {game.wpaHistory.map((wp, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm transition-all"
                style={{
                  height: `${wp}%`,
                  backgroundColor: homeClr,
                  opacity: i === game.wpaHistory.length - 1 ? 1 : 0.4,
                  minHeight: 1,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
