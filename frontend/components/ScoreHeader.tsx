'use client';

import { LiveGame, InningScore, TEAM_COLOR } from '@/lib/types';

interface Props {
  game: LiveGame;
}

const STATUS_LABEL: Record<string, string> = {
  live: '진행중', done: '종료', scheduled: '경기예정',
};

function TeamBlock({ name, score, record, isHome }: {
  name: string; score: number; record?: string; isHome: boolean;
}) {
  const color = TEAM_COLOR[name] ?? '#333';
  return (
    <div className={`flex flex-col items-center gap-1 ${isHome ? '' : ''}`}>
      {/* 팀 색상 원형 배지 */}
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-sm shadow-md"
        style={{ backgroundColor: color }}
      >
        {name}
      </div>
      <span className="text-white/70 text-xs">{isHome ? '홈' : '원정'}</span>
      {record && <span className="text-white/50 text-[10px]">{record}</span>}
      <span className="text-white font-black text-5xl leading-none mt-1">{score}</span>
    </div>
  );
}

function InningTable({ game }: { game: LiveGame }) {
  const scores = game.inningScores ?? [];
  // 최소 9이닝, 실제 데이터 또는 빈칸
  const maxInning = Math.max(9, scores.length);
  const innings = Array.from({ length: maxInning }, (_, i) => {
    const s = scores.find((s) => s.inning === i + 1);
    return { inning: i + 1, away: s?.away ?? null, home: s?.home ?? null };
  });

  // 합계
  const awayTotal = innings.reduce((s, r) => s + (r.away ?? 0), 0);
  const homeTotal = innings.reduce((s, r) => s + (r.home ?? 0), 0);

  const cell = 'w-7 text-center text-xs py-1 border-r border-white/10 last:border-0';

  return (
    <div className="overflow-x-auto scrollbar-hide mt-3">
      <table className="text-white text-xs w-full min-w-max border-collapse">
        <thead>
          <tr className="bg-white/10">
            <th className="text-left pl-3 pr-4 py-1 font-semibold w-16">팀</th>
            {innings.map((r) => (
              <th key={r.inning} className={cell}>{r.inning}</th>
            ))}
            <th className="w-7 text-center text-xs py-1 border-l border-white/20 font-bold">R</th>
          </tr>
        </thead>
        <tbody>
          {[
            { label: game.away, scores: innings.map((r) => r.away), total: game.awayScore },
            { label: game.home, scores: innings.map((r) => r.home), total: game.homeScore },
          ].map((row) => (
            <tr key={row.label} className="border-t border-white/10 hover:bg-white/5">
              <td className="pl-3 pr-4 py-1.5 font-bold text-white/90">{row.label}</td>
              {row.scores.map((s, i) => (
                <td key={i} className={`${cell} ${s === null ? 'text-white/30' : 'text-white'}`}>
                  {s !== null ? s : '-'}
                </td>
              ))}
              <td className="text-center font-black text-white border-l border-white/20">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScoreHeader({ game }: Props) {
  const statusLabel = STATUS_LABEL[game.status] ?? '';
  const situationText =
    game.status === 'live'
      ? `${game.inning} ${game.topBottom === 'top' ? '초' : '말'} ${game.outs}아웃`
      : game.status === 'done'
      ? `${game.duration ?? ''} ${game.stadium ?? ''}`
      : game.stadium ?? '';

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg" style={{ background: '#1e3a6e' }}>
      {/* 상단 상태 바 */}
      <div className="flex items-center justify-between px-5 py-2 bg-black/20 text-xs text-white/70">
        <span>{game.stadium ?? ''}</span>
        <span className={`font-semibold px-2 py-0.5 rounded-full text-[11px] ${
          game.status === 'live'
            ? 'bg-red-500 text-white animate-pulse'
            : 'bg-white/20 text-white/80'
        }`}>
          {statusLabel}
        </span>
        <span>{situationText}</span>
      </div>

      {/* 스코어 */}
      <div className="flex items-center justify-between px-8 py-5">
        <TeamBlock name={game.away} score={game.awayScore} record={game.awayRecord} isHome={false} />

        <div className="flex flex-col items-center gap-1">
          <span className="text-white/40 text-2xl font-light">:</span>
          {game.status === 'live' && (
            <div className="flex gap-1 mt-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    i < game.outs ? 'bg-yellow-400' : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
          )}
          {game.winPitcher && (
            <div className="text-center text-[10px] text-white/50 mt-2">
              <div>승 {game.winPitcher}</div>
              {game.savePitcher && <div>세 {game.savePitcher}</div>}
              {game.losePitcher && <div>패 {game.losePitcher}</div>}
            </div>
          )}
        </div>

        <TeamBlock name={game.home} score={game.homeScore} record={game.homeRecord} isHome={true} />
      </div>

      {/* 이닝별 점수 */}
      <InningTable game={game} />

      {/* 관중 */}
      {game.crowd && (
        <div className="text-right text-[10px] text-white/40 px-4 pb-2">
          관중 {game.crowd}명
        </div>
      )}
    </div>
  );
}
