'use client';

import { LiveGame, TEAM_COLOR } from '@/lib/types';

interface Props {
  game: LiveGame;
}

function PitcherCard({ name, team, isStarter, result, label }: {
  name: string;
  team: string;
  isStarter: boolean;
  result?: string;
  label: string;
}) {
  const color = TEAM_COLOR[team] ?? '#333';
  const resultStyle =
    result === '승' ? 'bg-blue-100 text-blue-700' :
    result === '패' ? 'bg-red-100 text-red-600'  :
    result === '세' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500';

  return (
    <div className="flex flex-col items-center gap-1.5 flex-1">
      <span className="text-[10px] text-gray-400 font-medium">{label}</span>
      {/* 팀 색상 원형 */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow"
        style={{ backgroundColor: color }}
      >
        {team}
      </div>
      <span className="font-bold text-sm text-gray-800">{name || '—'}</span>
      {result && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${resultStyle}`}>
          {result}
        </span>
      )}
      {isStarter && (
        <span className="text-[10px] text-gray-400">선발</span>
      )}
    </div>
  );
}

export function PitcherMatchup({ game }: Props) {
  // 종료 경기: 승패 표시
  // 진행중: 현재 투수 표시
  const isDone = game.status === 'done';

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
        투수 대결
      </p>

      <div className="flex items-start justify-around gap-2">
        {isDone ? (
          <>
            <PitcherCard
              name={game.awayStarter ?? game.currentPitcher ?? '—'}
              team={game.away}
              isStarter={true}
              result={game.losePitcher === game.awayStarter ? '패' : undefined}
              label="원정 선발"
            />

            <div className="flex flex-col items-center justify-center pt-4 gap-1">
              <span className="text-gray-200 text-lg font-light">VS</span>
              {game.winPitcher && (
                <div className="text-center mt-1">
                  <p className="text-[10px] text-gray-400">승 {game.winPitcher}</p>
                  {game.savePitcher && (
                    <p className="text-[10px] text-gray-400">세 {game.savePitcher}</p>
                  )}
                  {game.losePitcher && (
                    <p className="text-[10px] text-gray-400">패 {game.losePitcher}</p>
                  )}
                </div>
              )}
            </div>

            <PitcherCard
              name={game.homeStarter ?? '—'}
              team={game.home}
              isStarter={true}
              result={game.winPitcher === game.homeStarter ? '승' : undefined}
              label="홈 선발"
            />
          </>
        ) : (
          <>
            <PitcherCard
              name={game.awayStarter ?? '—'}
              team={game.away}
              isStarter={true}
              label="원정 선발"
            />

            <div className="flex flex-col items-center justify-center pt-4">
              <span className="text-gray-200 text-lg font-light">VS</span>
              {game.currentPitcher && (
                <div className="text-center mt-2">
                  <p className="text-[10px] text-gray-400">현재 투수</p>
                  <p className="text-xs font-bold text-gray-700">{game.currentPitcher}</p>
                </div>
              )}
            </div>

            <PitcherCard
              name={game.homeStarter ?? '—'}
              team={game.home}
              isStarter={true}
              label="홈 선발"
            />
          </>
        )}
      </div>
    </div>
  );
}
