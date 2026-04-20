"""
APScheduler — KBO 일일 예측 파이프라인
──────────────────────────────────────
매일 오전 10시 (Asia/Seoul) 자동 실행:
  1) kbo_scraper.run_daily_batch  — 오늘/내일 경기 크롤링 + ERA/WHIP/최근기록
  2) wp_calculator.calculate_wp   — 로지스틱 승률 계산
  3) ai_comment.generate_comment  — Claude AI 예측 코멘트 (Redis 캐시)
  4) 결과를 Redis game:{date}:{gId} 에 업데이트

FastAPI lifespan에서 setup_scheduler() 를 호출하세요.
"""

import asyncio
import json
import logging
from datetime import datetime

import redis.asyncio as aioredis
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from crawler.kbo_scraper import run_daily_batch, REDIS_URL as _SCRAPER_REDIS_URL
from predictor.wp_calculator import calculate_wp
from predictor.ai_comment import generate_comment

logger = logging.getLogger("uvicorn.error")

_scheduler: AsyncIOScheduler | None = None
REDIS_URL = _SCRAPER_REDIS_URL  # .env의 REDIS_URL 사용


async def run_prediction_pipeline() -> None:
    """크롤러 → WP 계산 → AI 코멘트 순서 파이프라인"""
    today = datetime.now().strftime("%Y%m%d")
    logger.info(f"[스케줄러] 예측 파이프라인 시작 ({today})")

    # Redis 연결
    try:
        r = aioredis.from_url(REDIS_URL, decode_responses=True)
        await r.ping()
    except Exception as e:
        logger.error(f"[스케줄러] Redis 연결 실패: {e}")
        return

    try:
        # 1. 크롤링 (오늘/내일 경기 + 팀 최근 기록 + ERA/WHIP)
        games = await run_daily_batch(r)
        logger.info(f"[스케줄러] 크롤링 완료: {len(games)}경기")

        # 2~3. WP 계산 + AI 코멘트
        for game in games:
            # 예정/진행 경기만 예측 생성 (종료 경기는 skip)
            if game.get("status") == "done":
                continue

            # WP 계산
            wp = calculate_wp(game)
            game["away_win_pct"] = wp["away_win_pct"]
            game["home_win_pct"] = wp["home_win_pct"]
            game["wp_factors"]   = wp["factors"]

            # AI 코멘트
            try:
                game["ai_comment"] = await generate_comment(game, r)
            except Exception as e:
                logger.warning(
                    f"[스케줄러] AI 코멘트 실패 ({game.get('gId')}): {e}"
                )
                game["ai_comment"] = ""

            # 업데이트된 예측 데이터 Redis에 반영
            date = game.get("date", today)
            g_id = game.get("gId", "")
            if g_id:
                await r.set(
                    f"game:{date}:{g_id}",
                    json.dumps(game, ensure_ascii=False),
                    ex=86400 * 2,
                )

        scheduled = [g for g in games if g.get("status") != "done"]
        logger.info(f"[스케줄러] 파이프라인 완료: {len(scheduled)}경기 예측 생성")

    except Exception as e:
        logger.error(f"[스케줄러] 파이프라인 오류: {e}", exc_info=True)
    finally:
        await r.aclose()


def setup_scheduler() -> AsyncIOScheduler:
    """
    AsyncIOScheduler 초기화 및 일일 10시 작업 등록.
    FastAPI lifespan에서 호출: scheduler = setup_scheduler(); scheduler.start()
    """
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    _scheduler = AsyncIOScheduler(timezone="Asia/Seoul")
    _scheduler.add_job(
        run_prediction_pipeline,
        trigger="cron",
        hour=10,
        minute=0,
        id="daily_kbo_prediction",
        name="KBO 일일 예측 파이프라인",
        replace_existing=True,
        misfire_grace_time=3600,  # 1시간 이내 지연 허용
    )
    logger.info("[스케줄러] 등록 완료 — 매일 10:00 KST 실행")
    return _scheduler


def get_scheduler() -> AsyncIOScheduler | None:
    return _scheduler
