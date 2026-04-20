'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePredictions, getTomorrowDate, formatDateLabel } from '@/lib/usePredictions';
import type { PredictionGame, WpFactor } from '@/lib/types';
import { TEAM_COLOR } from '@/lib/types';

// ── 타이핑 효과 ──────────────────────────────────────────────────────────────

function TypingText({ text, speed = 16 }: { text: string; speed?: number }) {
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
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  if (!text) {
    return (
      <span className="inline-flex items-center gap-1.5 text-gray-400 text-sm">
        <span className="w-3 h-3 border border-gray-300 border-t-transparent rounded-full animate-spin" />
        AI 분석 준비 중...
      </span>
    );
  }

  return (
    <span>
      {displayed}
      {!done && (
        <span className="inline-block w-0.5 h-3.5 bg-gray-500 ml-0.5 align-middle animate-pulse" />
      )}
    </span>
  );
}

// ── 승률 바 ───────────────────────────────────────────────────────────────────

function WinBar({
  awayPct,
  homePct,
  awayColor,
  homeColor,
  awayTeam,
  homeTeam,
}: {
  awayPct: number; homePct: number;
  awayColor: string; homeColor: string;
  awayTeam: string; homeTeam: string;
}) {
  return (
    <div>
      <div className="flex h-5 rounded-full overflow-hidden shadow-inner">
        <div
          className="flex items-center justify-end pr-2 text-white text-[11px] font-bold transition-all duration-700"
          style={{ width: `${awayPct}%`, backgroundColor: awayColor }}
        >
          {awayPct >= 20 && `${awayPct}%`}
        </div>
        <div
          className="flex items-center justify-start pl-2 text-white text-[11px] font-bold transition-all duration-700"
          style={{ width: `${homePct}%`, backgroundColor: homeColor }}
        >
          {homePct >= 20 && `${homePct}%`}
        </div>
      </div>
      <div className="flex justify-between mt-1.5 text-xs font-semibold">
        <span style={{ color: awayColor }}>{awayTeam} {awayPct}%</span>
        <span style={{ color: homeColor }}>{homeTeam} {homePct}%</span>
      </div>
    </div>
  );
}

// ── 요인 배지 ─────────────────────────────────────────────────────────────────

function FactorBadge({ factor }: { factor: WpFactor }) {
  const isHome = factor.side === 'home';
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
        isHome
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-orange-50 text-orange-700 border-orange-200'
      }`}
    >
      <span className="opacity-60">{isHome ? '홈' : '원정'}</span>
      {factor.label}
    </span>
  );
}

// ── 경기 카드 ─────────────────────────────────────────────────────────────────

function PredictionCard({ game }: { game: PredictionGame }) {
  const awayColor = TEAM_COLOR[game.away] ?? '#555';
  const homeColor = TEAM_COLOR[game.home] ?? '#1e3a6e';

  const awayEra = typeof game.away_era === 'number'
    ? game.away_era.toFixed(2)
    : game.away_era ?? 'N/A';
  const homeEra = typeof game.home_era === 'number'
    ? game.home_era.toFixed(2)
    : game.home_era ?? 'N/A';

  const awayPct = game.away_win_pct ?? 50;
  const homePct = game.home_win_pct ?? 50;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* 팀 헤더 */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-3 flex-1">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-white text-xs font-black shadow-sm"
            style={{ backgroundColor: awayColor }}
          >
            {game.away}
          </div>
          <div>
            <p className="font-black text-lg leading-none" style={{ color: awayColor }}>
              {game.away}
            </p>
            {game.awayRecord && (
              <p className="text-[11px] text-gray-400 mt-0.5">{game.awayRecord}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center px-3">
          <span className="text-gray-300 text-xs font-light">VS</span>
          {game.stadium && (
            <span className="text-[10px] text-gray-400 mt-0.5">{game.stadium}</span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-1 justify-end">
          <div className="text-right">
            <p className="font-black text-lg leading-none" style={{ color: homeColor }}>
              {game.home}
            </p>
            {game.homeRecord && (
              <p className="text-[11px] text-gray-400 mt-0.5">{game.homeRecord}</p>
            )}
          </div>
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-white text-xs font-black shadow-sm"
            style={{ backgroundColor: homeColor }}
          >
            {game.home}
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 flex flex-col gap-4">
        {/* 투수 대결 */}
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-3">
            선발 투수 대결
          </p>
          <div className="flex items-center justify-between gap-2">
            {/* 원정 투수 */}
            <div className="flex-1 text-center">
              <p className="font-bold text-sm text-gray-800">
                {game.awayStarter || '미정'}
              </p>
              {game.awayStarter && awayEra !== 'N/A' && Number(awayEra) > 0 && (
                <p className="text-[11px] text-gray-500 mt-0.5">ERA {awayEra}</p>
              )}
            </div>
            <div className="text-gray-200 text-sm font-light">VS</div>
            {/* 홈 투수 */}
            <div className="flex-1 text-center">
              <p className="font-bold text-sm text-gray-800">
                {game.homeStarter || '미정'}
              </p>
              {game.homeStarter && homeEra !== 'N/A' && Number(homeEra) > 0 && (
                <p className="text-[11px] text-gray-500 mt-0.5">ERA {homeEra}</p>
              )}
            </div>
          </div>
        </div>

        {/* 승률 예측 바 */}
        <div>
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-2.5">
            승리 예측
          </p>
          <WinBar
            awayPct={awayPct}
            homePct={homePct}
            awayColor={awayColor}
            homeColor={homeColor}
            awayTeam={game.away}
            homeTeam={game.home}
          />
        </div>

        {/* WP 요인 배지 */}
        {game.wp_factors && game.wp_factors.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {game.wp_factors.map((f, i) => (
              <FactorBadge key={i} factor={f} />
            ))}
          </div>
        )}

        {/* 최근 10경기 */}
        {(game.away_recent_wins != null || game.home_recent_wins != null) && (
          <div className="flex justify-between text-xs text-gray-500">
            <span>
              최근 10경기&nbsp;
              <span className="font-semibold" style={{ color: awayColor }}>
                {game.away} {game.away_recent_wins}승
              </span>
            </span>
            <span>
              <span className="font-semibold" style={{ color: homeColor }}>
                {game.home} {game.home_recent_wins}승
              </span>
            </span>
          </div>
        )}

        {/* AI 코멘트 */}
        <div className="border-t border-gray-100 pt-3.5">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-2">
            AI 분석
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">
            <TypingText text={game.ai_comment ?? ''} />
          </p>
          {!game.ai_comment && (
            <p className="text-[11px] text-gray-400 mt-1">
              오전 10시 파이프라인 실행 후 생성됩니다
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 빈 상태 ───────────────────────────────────────────────────────────────────

function EmptyState({ date }: { date: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">
        ⚾
      </div>
      <p className="text-sm font-medium text-gray-500">예측 데이터 없음</p>
      <p className="text-xs text-center">
        {formatDateLabel(date)} 경기 데이터가 아직 없습니다.
        <br />
        매일 오전 10시에 자동 업데이트됩니다.
      </p>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function PredictPage() {
  const tomorrow = getTomorrowDate();
  const dateLabel = formatDateLabel(tomorrow);
  const { games, isLoading, isError } = usePredictions(tomorrow);

  return (
    <div className="min-h-screen bg-[#f4f6f8]">
      {/* 헤더 */}
      <header className="bg-[#1e3a6e] text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <Link href="/" className="text-white/60 hover:text-white transition-colors text-sm">
          ← 실시간
        </Link>
        <div className="flex-1">
          <h1 className="font-black text-base tracking-tight leading-none">내일 경기 예측</h1>
          <p className="text-white/50 text-[11px] mt-0.5">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/60">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
          AI 분석
        </div>
      </header>

      {/* 콘텐츠 */}
      <div className="max-w-2xl mx-auto px-3 py-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <div className="w-7 h-7 border-2 border-[#1e3a6e] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">예측 데이터 불러오는 중...</p>
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-gray-400">
            <p className="text-red-500 text-sm font-semibold">⚠ 데이터 로드 실패</p>
            <p className="text-xs">백엔드 서버가 실행 중인지 확인하세요 (port 8001)</p>
          </div>
        )}

        {!isLoading && !isError && games.length === 0 && (
          <EmptyState date={tomorrow} />
        )}

        {!isLoading && !isError && games.length > 0 && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-gray-400 px-1">
              {games.length}경기 · AI 분석은 오전 10시 자동 업데이트
            </p>
            {games.map((game) => (
              <PredictionCard key={game.gId ?? game.id} game={game} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
