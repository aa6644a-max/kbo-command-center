import asyncio
import json
import logging
import random
from contextlib import asynccontextmanager
from typing import List

import os
from dotenv import load_dotenv
load_dotenv()

import redis.asyncio as aioredis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from scheduler import setup_scheduler, get_scheduler, run_prediction_pipeline
from crawler.kbo_scraper import run as run_crawler, fetch_standings

logger = logging.getLogger("uvicorn.error")

REDIS_URL = "redis://localhost:6379"
BROADCAST_INTERVAL = 3  # seconds

# Redis 없을 때 사용하는 폴백 데이터
MOCK_GAMES = [
    {
        "id": 1,
        "status": "live",
        "home": "LG",
        "away": "KT",
        "homeScore": 3,
        "awayScore": 2,
        "inning": "7회",
        "topBottom": "top",
        "outs": 1,
        "bases": [True, False, True],
        "homeWP": 58,
        "wpaHistory": [50, 52, 55, 53, 57, 58],
        "currentPitcher": "임찬규",
        "currentBatter": "강백호",
        "absPitches": [
            {"x": 0.1, "z": 0.75, "result": "strike", "velocity": 148, "pitchType": "FF"},
            {"x": -0.3, "z": 0.55, "result": "ball", "velocity": 146, "pitchType": "FF"},
            {"x": 0.2, "z": 0.85, "result": "swinging_strike", "velocity": 133, "pitchType": "SL"},
        ],
        "pitchClockRemaining": 20,
    },
    {
        "id": 2,
        "status": "live",
        "home": "삼성",
        "away": "KIA",
        "homeScore": 1,
        "awayScore": 4,
        "inning": "5회",
        "topBottom": "bottom",
        "outs": 2,
        "bases": [False, True, False],
        "homeWP": 31,
        "wpaHistory": [50, 48, 42, 35, 31],
        "currentPitcher": "양현종",
        "currentBatter": "구자욱",
        "absPitches": [
            {"x": -0.1, "z": 0.65, "result": "ball", "velocity": 142, "pitchType": "FF"},
            {"x": 0.4, "z": 0.70, "result": "strike", "velocity": 125, "pitchType": "CH"},
        ],
        "pitchClockRemaining": 15,
    },
]


# ── Redis 클라이언트 (전역, 선택적) ────────────────────────────────────────────

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis | None:
    global _redis
    if _redis is not None:
        return _redis
    try:
        client = aioredis.from_url(REDIS_URL, decode_responses=True)
        await client.ping()
        _redis = client
        logger.info("Redis 연결 성공 — 크롤러 데이터 모드")
        return _redis
    except Exception:
        logger.warning("Redis 연결 실패 — Mock 데이터 모드로 실행")
        return None


# ── 게임 데이터 읽기 ────────────────────────────────────────────────────────────

async def fetch_games_from_redis(r: aioredis.Redis) -> list[dict]:
    """Redis에서 game:{id} 키를 모두 읽어 반환"""
    ids = await r.lrange("games:ids", 0, -1)
    if not ids:
        # 인덱스 없으면 game:* 키 직접 스캔
        keys = [k async for k in r.scan_iter("game:*")]
        ids = [k.split(":")[1] for k in keys]

    games = []
    for gid in ids:
        raw = await r.get(f"game:{gid}")
        if raw:
            try:
                games.append(json.loads(raw))
            except json.JSONDecodeError:
                pass
    return games


async def get_current_games() -> list[dict]:
    """Redis 우선, 없으면 Mock 반환"""
    r = await get_redis()
    if r:
        try:
            games = await fetch_games_from_redis(r)
            if games:
                return games
        except Exception as e:
            logger.warning(f"Redis 읽기 오류: {e}")
    return MOCK_GAMES


# ── ConnectionManager ───────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        disconnected = []
        for conn in self.active_connections:
            try:
                await conn.send_text(json.dumps(message, ensure_ascii=False))
            except Exception:
                disconnected.append(conn)
        for conn in disconnected:
            self.active_connections.remove(conn)


manager = ConnectionManager()


# ── 브로드캐스트 루프 ────────────────────────────────────────────────────────────

async def broadcast_updates():
    """
    Redis(크롤러 데이터) 또는 Mock 데이터를 읽어 3초마다 WebSocket으로 브로드캐스트.
    Redis가 연결되면 실시간 크롤 데이터를, 없으면 Mock 시뮬레이션을 사용.
    """
    while True:
        await asyncio.sleep(BROADCAST_INTERVAL)
        if not manager.active_connections:
            continue

        games = await get_current_games()

        # Mock 모드일 때만 랜덤 시뮬레이션 적용
        r = await get_redis()
        if r is None:
            for game in games:
                if random.random() < 0.2:
                    game["homeWP"] = max(5, min(95, game["homeWP"] + random.randint(-4, 4)))
                    game["wpaHistory"].append(game["homeWP"])
                    if len(game["wpaHistory"]) > 20:
                        game["wpaHistory"].pop(0)

        for game in games:
            await manager.broadcast({"type": "GAME_UPDATE", "payload": game})


# ── Lifespan ────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_redis()
    asyncio.create_task(run_crawler())       # KBO 실시간 크롤러
    asyncio.create_task(broadcast_updates()) # WebSocket 브로드캐스트
    scheduler = setup_scheduler()
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)
    if _redis:
        await _redis.aclose()


# ── App ─────────────────────────────────────────────────────────────────────────

app = FastAPI(title="KBO Command Center API", lifespan=lifespan)

_cors_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")
CORS_ORIGINS = [o.strip() for o in _cors_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── WebSocket ───────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    # 접속 즉시 현재 전체 경기 상태 전송
    games = await get_current_games()
    for game in games:
        await websocket.send_text(
            json.dumps({"type": "GAME_UPDATE", "payload": game}, ensure_ascii=False)
        )
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ── REST ────────────────────────────────────────────────────────────────────────

@app.get("/games")
async def get_games():
    return await get_current_games()


@app.get("/predictions/{date}")
async def get_predictions(date: str):
    """game:{date}:* 키에서 예측 데이터 반환"""
    r = await get_redis()
    if not r:
        return []
    keys = [k async for k in r.scan_iter(f"game:{date}:*")]
    games = []
    for key in keys:
        raw = await r.get(key)
        if raw:
            try:
                games.append(json.loads(raw))
            except json.JSONDecodeError:
                pass
    return games


@app.get("/standings")
async def get_standings():
    """팀 순위 반환 (Redis 캐시 1시간)"""
    r = await get_redis()
    if r:
        cached = await r.get("standings:latest")
        if cached:
            try:
                return json.loads(cached)
            except json.JSONDecodeError:
                pass

    standings = await fetch_standings()

    if r and standings:
        await r.set("standings:latest", json.dumps(standings, ensure_ascii=False), ex=3600)

    return standings


@app.post("/pipeline/run")
async def trigger_pipeline():
    """예측 파이프라인 수동 실행"""
    asyncio.create_task(run_prediction_pipeline())
    return {"status": "started"}


@app.get("/health")
async def health_check():
    r = await get_redis()
    redis_status = "connected" if r else "unavailable"
    last_updated = None
    if r:
        last_updated = await r.get("games:last_updated")
    return {
        "status": "ok",
        "connections": len(manager.active_connections),
        "redis": redis_status,
        "last_crawled": last_updated,
    }
