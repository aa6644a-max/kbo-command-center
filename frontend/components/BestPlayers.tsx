'use client';

import { LiveGame, TEAM_COLOR } from '@/lib/types';

interface Props {
  game: LiveGame;
}

interface HighlightCard {
  label: string;
  name: string;
  team: string;
  stat: string;
  color: string;
}

function deriveHighlights(game: LiveGame): HighlightCard[] {
  const cards: HighlightCard[] = [];

  // 승리 투수
  if (game.winPitcher) {
    cards.push({
      label: '승리 투수',
      name: game.winPitcher,
      team: game.home,    // 간략 귀속 (실제론 팀 매핑 필요)
      stat: 'WIN',
      color: TEAM_COLOR[game.home] ?? '#1e3a6e',
    });
  }

  // 세이브
  if (game.savePitcher) {
    cards.push({
      label: '세이브',
      name: game.savePitcher,
      team: game.home,
      stat: 'SV',
      color: TEAM_COLOR[game.home] ?? '#1e3a6e',
    });
  }

  // 패전 투수
  if (game.losePitcher) {
    cards.push({
      label: '패전 투수',
      name: game.losePitcher,
      team: game.away,
      stat: 'LOSS',
      color: TEAM_COLOR[game.away] ?? '#888',
    });
  }

  // 박스스코어 타자 하이라이트 (awayBatters / homeBatters)
  const allBatters = [
    ...(game.awayBatters ?? []).map((b) => ({ ...b, teamName: game.away })),
    ...(game.homeBatters ?? []).map((b) => ({ ...b, teamName: game.home })),
  ];

  // 타점 1위
  const topRbi = [...allBatters].sort((a, b) => b.rbi - a.rbi)[0];
  if (topRbi?.rbi > 0) {
    cards.push({
      label: '최다 타점',
      name: topRbi.name,
      team: topRbi.teamName,
      stat: `${topRbi.rbi}타점 (${topRbi.h}안타)`,
      color: TEAM_COLOR[topRbi.teamName] ?? '#333',
    });
  }

  // 안타 1위
  const topH = [...allBatters].sort((a, b) => b.h - a.h)[0];
  if (topH?.h > 0 && topH.name !== topRbi?.name) {
    cards.push({
      label: '최다 안타',
      name: topH.name,
      team: topH.teamName,
      stat: `${topH.h}안타`,
      color: TEAM_COLOR[topH.teamName] ?? '#333',
    });
  }

  return cards.slice(0, 4);
}

export function BestPlayers({ game }: Props) {
  const cards = deriveHighlights(game);

  if (cards.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
          주요 활약
        </p>
        <p className="text-sm text-gray-400 text-center py-4">데이터 준비 중</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
        주요 활약
      </p>
      <div className="grid grid-cols-2 gap-2">
        {cards.map((c, i) => (
          <div
            key={i}
            className="rounded-lg p-3 text-white"
            style={{ backgroundColor: c.color }}
          >
            <p className="text-[10px] font-semibold opacity-70 mb-0.5">{c.label}</p>
            <p className="font-black text-base leading-tight">{c.name}</p>
            <p className="text-xs opacity-80 mt-0.5">{c.stat}</p>
            <p className="text-[10px] opacity-50 mt-1">{c.team}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
