'use client';

import { LiveGame, TEAM_COLOR } from '@/lib/types';

interface Props {
  games: LiveGame[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

const STATUS_DOT: Record<string, string> = {
  live:      'bg-red-500 animate-pulse',
  done:      'bg-gray-400',
  scheduled: 'bg-blue-400',
};

const STATUS_TEXT: Record<string, string> = {
  live: 'LIVE', done: '종료', scheduled: '예정',
};

export function GamePillList({ games, selectedId, onSelect }: Props) {
  if (games.length === 0) return null;

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide px-2">
        {games.map((game) => {
          const selected = game.id === selectedId;
          const awayColor = TEAM_COLOR[game.away] ?? '#333';
          const homeColor = TEAM_COLOR[game.home] ?? '#333';

          return (
            <button
              key={game.id}
              onClick={() => onSelect(game.id)}
              className={`
                flex-shrink-0 flex flex-col items-center px-4 py-2.5 border-b-2 transition-all
                ${selected
                  ? 'border-[#1e3a6e] bg-blue-50'
                  : 'border-transparent hover:bg-gray-50'}
              `}
            >
              {/* 상태 */}
              <div className="flex items-center gap-1 mb-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[game.status]}`} />
                <span className={`text-[10px] font-bold ${
                  game.status === 'live' ? 'text-red-500' : 'text-gray-400'
                }`}>
                  {game.status === 'live'
                    ? `${game.inning} ${game.topBottom === 'top' ? '초' : '말'}`
                    : STATUS_TEXT[game.status]}
                </span>
              </div>

              {/* 팀 + 점수 */}
              <div className="flex items-center gap-2 text-sm">
                <span className="font-bold" style={{ color: awayColor }}>{game.away}</span>
                <div className="flex items-baseline gap-1">
                  <span className={`font-black text-base tabular-nums ${
                    game.awayScore > game.homeScore ? 'text-gray-900' : 'text-gray-400'
                  }`}>{game.awayScore}</span>
                  <span className="text-gray-300 text-xs">:</span>
                  <span className={`font-black text-base tabular-nums ${
                    game.homeScore > game.awayScore ? 'text-gray-900' : 'text-gray-400'
                  }`}>{game.homeScore}</span>
                </div>
                <span className="font-bold" style={{ color: homeColor }}>{game.home}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
