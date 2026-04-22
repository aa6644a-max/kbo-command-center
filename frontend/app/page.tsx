'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  usePredictions,
  useStandings,
  getTodayDate,
  getTomorrowDate,
  formatDateLabel,
} from '@/lib/usePredictions';
import type { PredictionGame, WpFactor, TeamStanding } from '@/lib/types';
import { TEAM_COLOR } from '@/lib/types';

// ── 타이핑 효과 ───────────────────────────────────────────────────────────────

function TypingText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!text) return;
    setDisplayed('');
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(id); setDone(true); }
    }, 14);
    return () => clearInterval(id);
  }, [text]);

  if (!text) return (
    <span className="text-gray-400 text-sm">AI 분석 준비 중...</span>
  );
  return (
    <span>
      {displayed}
      {!done && <span className="inline-block w-0.5 h-3.5 bg-gray-400 ml-0.5 align-middle animate-pulse" />}
    </span>
  );
}

// ── 승률 바 ───────────────────────────────────────────────────────────────────

function WinBar({ awayPct, homePct, awayColor, homeColor, awayTeam, homeTeam }: {
  awayPct: number; homePct: number;
  awayColor: string; homeColor: string;
  awayTeam: string; homeTeam: string;
}) {
  return (
    <div>
      {/* 퍼센트 숫자 */}
      <div className="flex justify-between items-end mb-2">
        <div className="text-left">
          <span className="text-3xl font-black" style={{ color: awayColor }}>{awayPct}</span>
          <span className="text-sm font-bold text-gray-400 ml-0.5">%</span>
          <p className="text-[11px] text-gray-400 mt-0.5">{awayTeam} 승리</p>
        </div>
        <div className="text-xs text-gray-300 font-light self-center">VS</div>
        <div className="text-right">
          <span className="text-3xl font-black" style={{ color: homeColor }}>{homePct}</span>
          <span className="text-sm font-bold text-gray-400 ml-0.5">%</span>
          <p className="text-[11px] text-gray-400 mt-0.5">{homeTeam} 승리</p>
        </div>
      </div>
      {/* 바 */}
      <div className="flex h-3 rounded-full overflow-hidden">
        <div
          className="transition-all duration-700"
          style={{ width: `${awayPct}%`, backgroundColor: awayColor }}
        />
        <div
          className="transition-all duration-700"
          style={{ width: `${homePct}%`, backgroundColor: homeColor }}
        />
      </div>
    </div>
  );
}

// ── 요인 배지 ─────────────────────────────────────────────────────────────────

function FactorBadge({ factor }: { factor: WpFactor }) {
  const isHome = factor.side === 'home';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
      isHome
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-orange-50 text-orange-700 border-orange-200'
    }`}>
      <span className="opacity-60">{isHome ? '홈' : '원정'}</span>
      {factor.label}
    </span>
  );
}

// ── 예측 카드 ─────────────────────────────────────────────────────────────────

function PredictionCard({ game }: { game: PredictionGame }) {
  const awayColor = TEAM_COLOR[game.away] ?? '#555';
  const homeColor = TEAM_COLOR[game.home] ?? '#1e3a6e';
  const awayPct = game.away_win_pct ?? 50;
  const homePct = game.home_win_pct ?? 50;
  const awayEra = typeof game.away_era === 'number' ? game.away_era.toFixed(2) : null;
  const homeEra = typeof game.home_era === 'number' ? game.home_era.toFixed(2) : null;

  // 우세 팀 판단
  const favorite = awayPct > homePct ? game.away : game.home;
  const favoriteColor = awayPct > homePct ? awayColor : homeColor;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* 우세 팀 배너 */}
      {Math.abs(awayPct - homePct) >= 10 && (
        <div
          className="px-4 py-1.5 text-[11px] font-bold text-white flex items-center gap-1.5"
          style={{ backgroundColor: favoriteColor }}
        >
          <span className="opacity-80">토토 추천</span>
          <span>{favorite} 승리</span>
          <span className="ml-auto opacity-70">
            {Math.max(awayPct, homePct)}% 예측
          </span>
        </div>
      )}

      <div className="px-5 pt-5 pb-4">
        {/* 팀 vs 팀 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 flex-1">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-sm shadow"
              style={{ backgroundColor: awayColor }}
            >
              {game.away}
            </div>
            <div>
              <p className="font-black text-xl leading-none" style={{ color: awayColor }}>
                {game.away}
              </p>
              {game.awayRecord && (
                <p className="text-[11px] text-gray-400 mt-0.5">{game.awayRecord}</p>
              )}
            </div>
          </div>

          <div className="text-center px-2">
            {game.stadium && (
              <p className="text-[10px] text-gray-400">{game.stadium}</p>
            )}
          </div>

          <div className="flex items-center gap-3 flex-1 justify-end">
            <div className="text-right">
              <p className="font-black text-xl leading-none" style={{ color: homeColor }}>
                {game.home}
              </p>
              {game.homeRecord && (
                <p className="text-[11px] text-gray-400 mt-0.5">{game.homeRecord}</p>
              )}
            </div>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-sm shadow"
              style={{ backgroundColor: homeColor }}
            >
              {game.home}
            </div>
          </div>
        </div>

        {/* 승률 바 */}
        <WinBar
          awayPct={awayPct} homePct={homePct}
          awayColor={awayColor} homeColor={homeColor}
          awayTeam={game.away} homeTeam={game.home}
        />
      </div>

      <div className="px-5 pb-5 flex flex-col gap-3.5 border-t border-gray-50 pt-3.5">
        {/* 선발 투수 */}
        <div className="bg-gray-50 rounded-xl px-4 py-3">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-2">
            선발 투수
          </p>
          <div className="flex justify-between items-center gap-2">
            <div className="text-center flex-1">
              <p className="font-bold text-sm text-gray-800">{game.awayStarter || '미정'}</p>
              {awayEra && Number(awayEra) > 0 && (
                <p className="text-[11px] text-gray-500">ERA {awayEra}</p>
              )}
            </div>
            <span className="text-gray-200 text-xs">VS</span>
            <div className="text-center flex-1">
              <p className="font-bold text-sm text-gray-800">{game.homeStarter || '미정'}</p>
              {homeEra && Number(homeEra) > 0 && (
                <p className="text-[11px] text-gray-500">ERA {homeEra}</p>
              )}
            </div>
          </div>
        </div>

        {/* 최근 10경기 + 상대전적 */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {(game.away_recent_wins != null || game.home_recent_wins != null) && (
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-gray-400 mb-1">최근 10경기</p>
              <div className="flex justify-between">
                <span style={{ color: awayColor }} className="font-semibold">{game.away} {game.away_recent_wins}승</span>
                <span style={{ color: homeColor }} className="font-semibold">{game.home_recent_wins}승</span>
              </div>
            </div>
          )}
          {game.h2h_summary && game.h2h_summary !== '기록 없음' && (
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-gray-400 mb-1">상대 전적</p>
              <p className="text-gray-600 font-medium leading-tight">{game.h2h_summary}</p>
            </div>
          )}
        </div>

        {/* WP 요인 배지 */}
        {game.wp_factors && game.wp_factors.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {game.wp_factors.map((f, i) => <FactorBadge key={i} factor={f} />)}
          </div>
        )}

        {/* AI 코멘트 */}
        <div className="border-t border-gray-100 pt-3">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-1.5">
            AI 분석
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">
            <TypingText text={game.ai_comment ?? ''} />
          </p>
          {!game.ai_comment && (
            <p className="text-[11px] text-gray-400 mt-1">오전 10시 자동 업데이트</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 미니 순위표 ───────────────────────────────────────────────────────────────

function MiniStandings({ standings }: { standings: TeamStanding[] }) {
  if (standings.length === 0) return null;
  const top5 = standings.slice(0, 5);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-black text-gray-800">팀 순위</h2>
        <Link href="/teams" className="text-xs text-[#1e3a6e] font-semibold">전체 보기 →</Link>
      </div>
      <div className="flex flex-col gap-1.5">
        {top5.map((t) => {
          const color = TEAM_COLOR[t.team] ?? '#555';
          return (
            <div key={t.rank} className="flex items-center gap-3">
              <span className="w-4 text-xs text-gray-400 font-semibold text-right">{t.rank}</span>
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-black"
                style={{ backgroundColor: color }}
              >
                {t.team.slice(0, 1)}
              </div>
              <span className="flex-1 text-sm font-semibold text-gray-800">{t.team}</span>
              <span className="text-xs text-gray-500">{t.wins}승 {t.losses}패</span>
              <span className="text-xs font-bold text-gray-700 w-10 text-right">
                {(t.win_pct * 100).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 로딩 / 빈 상태 ────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
      <div className="w-7 h-7 border-2 border-[#1e3a6e] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm">예측 데이터 불러오는 중...</p>
    </div>
  );
}

function EmptyState({ date }: { date: string }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const triggerPipeline = async () => {
    setRunning(true);
    try {
      await fetch('/api/pipeline/run', { method: 'POST' });
      setDone(true);
      setTimeout(() => window.location.reload(), 3000);
    } catch {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-3xl">⚾</div>
      <p className="text-sm font-medium text-gray-500">{formatDateLabel(date)} 예측 없음</p>
      <p className="text-xs text-center text-gray-400">매일 오전 10시 자동 업데이트됩니다</p>
      {!done ? (
        <button
          onClick={triggerPipeline}
          disabled={running}
          className="mt-2 px-5 py-2 text-sm bg-[#1e3a6e] text-white rounded-full font-semibold disabled:opacity-50"
        >
          {running ? '분석 중...' : '지금 분석 실행'}
        </button>
      ) : (
        <p className="text-xs text-green-600 font-semibold">완료! 잠시 후 새로고침...</p>
      )}
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function Home() {
  const today = getTodayDate();
  const tomorrow = getTomorrowDate();
  const [activeDate, setActiveDate] = useState(tomorrow);

  const { games, isLoading, isError } = usePredictions(activeDate);
  const { standings } = useStandings();

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-20">
      {/* 헤더 */}
      <header className="bg-[#1e3a6e] text-white px-4 pt-5 pb-0 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-black text-xl tracking-tight leading-none">KBO 승률 예측</h1>
            <p className="text-white/50 text-[11px] mt-0.5">2026 시즌 · AI 분석</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/60">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            AI
          </div>
        </div>
        {/* 날짜 탭 */}
        <div className="flex gap-0">
          {[
            { date: today, label: '오늘' },
            { date: tomorrow, label: '내일' },
          ].map(({ date, label }) => (
            <button
              key={date}
              onClick={() => setActiveDate(date)}
              className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-colors ${
                activeDate === date
                  ? 'border-white text-white'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              {label}
              <span className={`ml-1.5 text-[10px] ${activeDate === date ? 'text-white/60' : 'text-white/30'}`}>
                {formatDateLabel(date)}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* 콘텐츠 */}
      <div className="max-w-2xl mx-auto px-3 py-4 flex flex-col gap-4">
        {isLoading && <LoadingState />}

        {isError && (
          <div className="flex flex-col items-center py-12 gap-2 text-gray-400">
            <p className="text-red-500 text-sm font-semibold">⚠ 데이터 로드 실패</p>
            <p className="text-xs">백엔드 서버를 확인하세요 (port 8001)</p>
          </div>
        )}

        {!isLoading && !isError && games.length === 0 && (
          <EmptyState date={activeDate} />
        )}

        {!isLoading && !isError && games.length > 0 && (
          <>
            <p className="text-xs text-gray-400 px-1">
              {games.length}경기 · {formatDateLabel(activeDate)}
            </p>
            {games.map((game) => (
              <PredictionCard key={game.gId ?? game.id} game={game} />
            ))}
          </>
        )}

        {/* 미니 순위표 */}
        <MiniStandings standings={standings} />
      </div>

      {/* 하단 네비게이션 */}
      <BottomNav active="home" />
    </div>
  );
}

// ── 하단 네비게이션 ───────────────────────────────────────────────────────────

export function BottomNav({ active }: { active: 'home' | 'teams' }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
      <Link
        href="/"
        className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-[10px] font-bold transition-colors ${
          active === 'home' ? 'text-[#1e3a6e]' : 'text-gray-400'
        }`}
      >
        <span className="text-lg leading-none">⚡</span>
        <span>예측</span>
      </Link>
      <Link
        href="/teams"
        className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-[10px] font-bold transition-colors ${
          active === 'teams' ? 'text-[#1e3a6e]' : 'text-gray-400'
        }`}
      >
        <span className="text-lg leading-none">🏆</span>
        <span>팀순위</span>
      </Link>
    </nav>
  );
}
