'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { LiveGame } from '@/lib/types';
import { useGameSocket } from '@/lib/useGameSocket';
import { getTomorrowDate, formatDateLabel } from '@/lib/usePredictions';
import { ScoreHeader }    from '@/components/ScoreHeader';
import { GamePillList }   from '@/components/GamePillList';
import { WinProbBar }     from '@/components/WinProbBar';
import { BestPlayers }    from '@/components/BestPlayers';
import { PitcherMatchup } from '@/components/PitcherMatchup';
import { BoxScore }       from '@/components/BoxScore';

const STATUS_ORDER: Record<string, number> = { live: 0, scheduled: 1, done: 2 };

export default function Home() {
  const [games, setGames]           = useState<Map<number, LiveGame>>(new Map());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [connected, setConnected]   = useState(false);
  const [timedOut, setTimedOut]     = useState(false);

  const handleUpdate = useCallback((game: LiveGame) => {
    setConnected(true);
    setGames((prev) => {
      const next = new Map(prev).set(game.id, game);
      return next;
    });
  }, []);

  useGameSocket(handleUpdate);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);

  // 첫 경기 자동 선택
  useEffect(() => {
    if (selectedId === null && games.size > 0) {
      const sorted = [...games.values()].sort(
        (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      );
      setSelectedId(sorted[0].id);
    }
  }, [games, selectedId]);

  const allGames = [...games.values()].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  );
  const selected = selectedId !== null ? games.get(selectedId) : null;

  // ── 로딩 / 오류 화면 ──────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <NavBar />
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400">
          {timedOut ? (
            <>
              <span className="text-red-500 text-lg font-bold">⚠ 백엔드 연결 실패</span>
              <p className="text-sm">서버가 실행 중인지 확인하세요 (port 8001)</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-1.5 text-sm bg-[#1e3a6e] text-white rounded hover:opacity-80"
              >
                재시도
              </button>
            </>
          ) : (
            <>
              <div className="w-7 h-7 border-2 border-[#1e3a6e] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">데이터 불러오는 중...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── 메인 레이아웃 ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f4f6f8]">
      <NavBar />

      {/* 내일 예측 배너 */}
      <PredictBanner />

      {/* 경기 탭 리스트 */}
      <GamePillList
        games={allGames}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {/* 메인 콘텐츠 */}
      {selected ? (
        <div className="max-w-2xl mx-auto px-3 py-4 flex flex-col gap-4">
          {/* 1. 스코어 헤더 */}
          <ScoreHeader game={selected} />

          {/* 2. 승리확률 + 투수대결 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <WinProbBar game={selected} />
            <PitcherMatchup game={selected} />
          </div>

          {/* 3. 주요 활약 */}
          <BestPlayers game={selected} />

          {/* 4. 박스스코어 */}
          <BoxScore game={selected} />
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
          위에서 경기를 선택하세요
        </div>
      )}
    </div>
  );
}

function NavBar() {
  return (
    <header className="bg-[#1e3a6e] text-white px-4 py-3 flex items-center justify-between shadow-md">
      <div>
        <h1 className="font-black text-lg tracking-tight leading-none">KBO 커맨드 센터</h1>
        <p className="text-white/50 text-[11px] mt-0.5">2026 시즌 실시간</p>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-white/70">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        LIVE
      </div>
    </header>
  );
}

function PredictBanner() {
  const tomorrow = getTomorrowDate();
  const label = formatDateLabel(tomorrow);
  return (
    <Link
      href="/predict"
      className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-[#0f2347] to-[#1e3a6e] text-white hover:opacity-90 active:opacity-80 transition-opacity"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">⚡</span>
        <div>
          <span className="text-xs font-bold">내일 경기 예측 보기</span>
          <span className="text-white/50 text-[11px] ml-2">{label}</span>
        </div>
      </div>
      <span className="text-white/50 text-xs">AI 분석 →</span>
    </Link>
  );
}
