'use client';

import { useState } from 'react';
import { LiveGame, BatterStat, PitcherStat, TEAM_COLOR } from '@/lib/types';

interface Props {
  game: LiveGame;
}

type Tab = 'away-bat' | 'home-bat' | 'away-pit' | 'home-pit';

function BatterTable({ batters, team }: { batters: BatterStat[]; team: string }) {
  if (batters.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">데이터 없음</p>;
  }

  const thCls = 'px-2 py-1.5 text-[11px] font-semibold text-gray-500 text-right first:text-left whitespace-nowrap';
  const tdCls = 'px-2 py-1.5 text-xs text-right first:text-left tabular-nums';

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <table className="w-full min-w-max border-collapse text-gray-800">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className={`${thCls} min-w-[80px]`}>선수</th>
            <th className={thCls}>타수</th>
            <th className={thCls}>득점</th>
            <th className={thCls}>안타</th>
            <th className={thCls}>타점</th>
            <th className={thCls}>볼넷</th>
            <th className={thCls}>삼진</th>
            <th className={thCls}>타율</th>
          </tr>
        </thead>
        <tbody>
          {batters.map((b, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/30">
              <td className={`${tdCls} font-medium`}>
                <span className="text-[10px] text-gray-400 mr-1">{b.pos}</span>
                {b.name}
              </td>
              <td className={tdCls}>{b.ab}</td>
              <td className={tdCls}>{b.r}</td>
              <td className={`${tdCls} font-semibold ${b.h > 0 ? 'text-blue-600' : ''}`}>{b.h}</td>
              <td className={`${tdCls} font-semibold ${b.rbi > 0 ? 'text-red-600' : ''}`}>{b.rbi}</td>
              <td className={tdCls}>{b.bb}</td>
              <td className={tdCls}>{b.k}</td>
              <td className={tdCls}>{b.avg}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PitcherTable({ pitchers, team }: { pitchers: PitcherStat[]; team: string }) {
  if (pitchers.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">데이터 없음</p>;
  }

  const RESULT_STYLE: Record<string, string> = {
    W: 'bg-blue-100 text-blue-700',
    L: 'bg-red-100 text-red-600',
    S: 'bg-green-100 text-green-700',
    H: 'bg-yellow-100 text-yellow-700',
  };

  const thCls = 'px-2 py-1.5 text-[11px] font-semibold text-gray-500 text-right first:text-left whitespace-nowrap';
  const tdCls = 'px-2 py-1.5 text-xs text-right first:text-left tabular-nums';

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <table className="w-full min-w-max border-collapse text-gray-800">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className={`${thCls} min-w-[80px]`}>선수</th>
            <th className={thCls}>이닝</th>
            <th className={thCls}>피안타</th>
            <th className={thCls}>실점</th>
            <th className={thCls}>자책</th>
            <th className={thCls}>볼넷</th>
            <th className={thCls}>삼진</th>
            <th className={thCls}>ERA</th>
          </tr>
        </thead>
        <tbody>
          {pitchers.map((p, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/30">
              <td className={`${tdCls} font-medium`}>
                {p.result && (
                  <span className={`text-[10px] font-bold px-1 py-0.5 rounded mr-1.5 ${RESULT_STYLE[p.result] ?? ''}`}>
                    {p.result}
                  </span>
                )}
                {p.name}
              </td>
              <td className={tdCls}>{p.ip}</td>
              <td className={tdCls}>{p.h}</td>
              <td className={tdCls}>{p.r}</td>
              <td className={tdCls}>{p.er}</td>
              <td className={tdCls}>{p.bb}</td>
              <td className={`${tdCls} font-semibold ${p.k > 0 ? 'text-purple-600' : ''}`}>{p.k}</td>
              <td className={tdCls}>{p.era}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BoxScore({ game }: Props) {
  const [tab, setTab] = useState<Tab>('away-bat');

  const awayColor = TEAM_COLOR[game.away] ?? '#333';
  const homeColor = TEAM_COLOR[game.home] ?? '#1e3a6e';

  const tabs: { key: Tab; label: string; color: string }[] = [
    { key: 'away-bat', label: `${game.away} 타자`, color: awayColor },
    { key: 'home-bat', label: `${game.home} 타자`, color: homeColor },
    { key: 'away-pit', label: `${game.away} 투수`, color: awayColor },
    { key: 'home-pit', label: `${game.home} 투수`, color: homeColor },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* 탭 헤더 */}
      <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-hide">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-shrink-0 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              tab === t.key
                ? 'border-current'
                : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            }`}
            style={tab === t.key ? { color: t.color, borderColor: t.color } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 테이블 내용 */}
      <div className="p-2">
        {tab === 'away-bat' && (
          <BatterTable batters={game.awayBatters ?? []} team={game.away} />
        )}
        {tab === 'home-bat' && (
          <BatterTable batters={game.homeBatters ?? []} team={game.home} />
        )}
        {tab === 'away-pit' && (
          <PitcherTable pitchers={game.awayPitchers ?? []} team={game.away} />
        )}
        {tab === 'home-pit' && (
          <PitcherTable pitchers={game.homePitchers ?? []} team={game.home} />
        )}
      </div>
    </div>
  );
}
