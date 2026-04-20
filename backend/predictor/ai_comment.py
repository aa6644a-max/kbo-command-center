"""
Claude AI 경기 예측 코멘트 생성기
──────────────────────────────────
- game_data를 받아 2~3문장 예측 코멘트 생성
- Redis prediction:{date}:{gId} 로 캐시 (TTL 24시간)
"""

import logging

import anthropic
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 250
CACHE_TTL = 86400  # 24시간


def _cache_key(game_data: dict) -> str:
    date   = game_data.get("date", "unknown")
    g_id   = game_data.get("gId") or str(game_data.get("id", ""))
    return f"prediction:{date}:{g_id}"


async def generate_comment(
    game_data: dict,
    r: aioredis.Redis | None = None,
) -> str:
    """
    game_data에서 경기 정보를 읽어 예측 코멘트를 생성합니다.
    r(Redis) 가 제공되면 캐시를 확인하고, 결과를 24시간 저장합니다.
    """
    key = _cache_key(game_data)

    # 캐시 확인
    if r:
        cached = await r.get(key)
        if cached:
            logger.debug(f"[AI] 캐시 히트: {key}")
            return cached

    away_team    = game_data.get("away", "원정팀")
    home_team    = game_data.get("home", "홈팀")
    away_pitcher = game_data.get("awayStarter") or "미정"
    home_pitcher = game_data.get("homeStarter") or "미정"
    away_era     = game_data.get("away_era") or "N/A"
    home_era     = game_data.get("home_era") or "N/A"
    away_recent  = game_data.get("away_recent_wins", "?")
    home_recent  = game_data.get("home_recent_wins", "?")
    h2h          = game_data.get("h2h_summary") or "기록 없음"

    if isinstance(away_era, float):
        away_era = f"{away_era:.2f}"
    if isinstance(home_era, float):
        home_era = f"{home_era:.2f}"

    prompt = (
        f"KBO 경기 예측 분석을 2~3문장으로 해줘.\n"
        f"경기: {away_team} vs {home_team}\n"
        f"원정 선발: {away_pitcher} (ERA {away_era})\n"
        f"홈 선발: {home_pitcher} (ERA {home_era})\n"
        f"원정 최근 10경기: {away_recent}승\n"
        f"홈 최근 10경기: {home_recent}승\n"
        f"상대 전적(시즌): {h2h}\n"
        f"핵심 변수 위주로 간결하게 분석해줘."
    )

    client = anthropic.AsyncAnthropic()
    try:
        message = await client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        comment: str = message.content[0].text.strip()
    except Exception as e:
        logger.error(f"[AI] Claude API 호출 실패 ({key}): {e}")
        comment = f"{away_team} vs {home_team} — 예측 코멘트 생성 실패"

    # 캐시 저장
    if r:
        await r.set(key, comment, ex=CACHE_TTL)
        logger.info(f"[AI] 코멘트 캐시 저장: {key}")

    return comment
