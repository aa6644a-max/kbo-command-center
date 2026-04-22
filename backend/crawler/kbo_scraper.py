"""
KBO 크롤러 — 공식 사이트 비공개 API 사용
────────────────────────────────────────────────
엔드포인트:
  [1] POST /ws/Main.asmx/GetKboGameList        → 날짜별 경기 목록 + 실시간 스코어
  [2] POST /ws/Schedule.asmx/GetScoreBoardScroll → 이닝별 스코어 + 팀 시즌 전적
  [3] POST /ws/Schedule.asmx/GetBoxScoreScroll   → 타자/투수 박스스코어

실시간 모드: run()           — 10초 간격, Redis game:{id}
배치 모드:   run_daily_batch() — 스케줄러 호출, Redis game:{date}:{gId}
"""

import asyncio
import hashlib
import json
import logging
import re
from datetime import datetime, timedelta
from functools import partial

import redis.asyncio as aioredis
import requests
from bs4 import BeautifulSoup

import os
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [KBO] %(message)s")
logger = logging.getLogger(__name__)

SCRAPE_INTERVAL = 10
REDIS_URL   = os.getenv("REDIS_URL", "redis://localhost:6379")
KBO_SEASON  = os.getenv("KBO_SEASON", "2026")
BASE = "https://www.koreabaseball.com"

GAME_LIST_URL  = f"{BASE}/ws/Main.asmx/GetKboGameList"
SCOREBOARD_URL = f"{BASE}/ws/Schedule.asmx/GetScoreBoardScroll"
BOXSCORE_URL   = f"{BASE}/ws/Schedule.asmx/GetBoxScoreScroll"
STANDING_URL   = f"{BASE}/ws/Main.asmx/GetKboStandingList"

BASE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9",
    "Referer": "https://www.koreabaseball.com",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
}

STATE_MAP = {"1": "scheduled", "2": "live", "3": "done"}

TEAM_ID_MAP = {
    "OB": "두산", "LG": "LG",  "SS": "삼성", "HH": "한화",
    "HT": "KIA",  "LT": "롯데", "SK": "SSG",  "KT": "KT",
    "NC": "NC",   "WO": "키움",
}

# KBO 표시명 → 팀 ID (역방향, 최근 기록 조회용)
TEAM_NAME_TO_ID = {v: k for k, v in TEAM_ID_MAP.items()}


# ── 유틸 ──────────────────────────────────────────────────────────────────────

def _g_id_to_int(g_id: str) -> int:
    return int(hashlib.md5(g_id.encode()).hexdigest()[:7], 16)


def _safe_int(val) -> int:
    try:
        return int(val) if val not in (None, "", "null") else 0
    except (ValueError, TypeError):
        return 0


def _safe_float(val) -> float:
    try:
        return float(val) if val not in (None, "", "null") else 0.0
    except (ValueError, TypeError):
        return 0.0


def _occupied(val) -> bool:
    return _safe_int(val) > 0


def _parse_ip(s) -> float:
    """KBO 이닝 표기 변환: "7" → 7.0, "6.1" → 6.333, "6.2" → 6.667"""
    try:
        s = str(s).strip()
        if "." in s:
            whole, outs = s.split(".", 1)
            return int(whole) + int(outs) / 3
        return float(s)
    except (ValueError, TypeError):
        return 0.0


def _make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(BASE_HEADERS)
    s.get(BASE, timeout=10)
    return s


# ── API 호출 (동기) ───────────────────────────────────────────────────────────

def api_get_game_list(session: requests.Session, game_date: str) -> list[dict]:
    resp = session.post(
        GAME_LIST_URL,
        data={"date": game_date, "leId": "1", "srId": "0"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json().get("game", [])


def api_get_scoreboard(session: requests.Session, g_id: str, game_date: str) -> dict:
    resp = session.post(
        SCOREBOARD_URL,
        data={"leId": "1", "srId": "0", "seasonId": KBO_SEASON,
              "gameDate": game_date, "gameId": g_id},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def api_get_boxscore(session: requests.Session, g_id: str, game_date: str) -> dict:
    resp = session.post(
        BOXSCORE_URL,
        data={"leId": "1", "srId": "0", "seasonId": KBO_SEASON,
              "gameDate": game_date, "gameId": g_id},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


# ── 파싱: 기본 ───────────────────────────────────────────────────────────────

def _parse_json_table_rows(json_str: str) -> list[list[str]]:
    try:
        tbl = json.loads(json_str)
        result = []
        for row_obj in tbl.get("rows", []):
            cells = [BeautifulSoup(c.get("Text", ""), "lxml").get_text(strip=True)
                     for c in row_obj.get("row", [])]
            result.append(cells)
        return result
    except Exception:
        return []


def _parse_table_with_headers(json_str: str) -> tuple[list[str], list[list[str]]]:
    """테이블 JSON → (headers, rows) 반환"""
    try:
        tbl = json.loads(json_str)
        raw_h = tbl.get("headers", {})
        if isinstance(raw_h, dict):
            header_cells = raw_h.get("row", [])
        elif isinstance(raw_h, list):
            header_cells = raw_h
        else:
            header_cells = []
        headers = [BeautifulSoup(c.get("Text", ""), "lxml").get_text(strip=True)
                   for c in header_cells]
        rows = []
        for row_obj in tbl.get("rows", []):
            cells = [BeautifulSoup(c.get("Text", ""), "lxml").get_text(strip=True)
                     for c in row_obj.get("row", [])]
            rows.append(cells)
        return headers, rows
    except Exception:
        return [], []


def _table_type(headers: list[str]) -> str | None:
    h = " ".join(headers)
    if any(k in h for k in ("이닝", "ERA", "자책")):
        return "pitcher"
    if any(k in h for k in ("타수", "타율", "안타")):
        return "batter"
    return None


# ── 파싱: 박스스코어 전체 ─────────────────────────────────────────────────────

# KBO 수비 포지션 약어 (선두 문자 기준)
_POS_CHARS = {"좌", "중", "우", "포", "투", "유", "지", "D"}


def _parse_batter_row(cells: list[str]) -> dict | None:
    """["{pos}{name}", ab, r, h, rbi, bb, k, avg] → dict"""
    if len(cells) < 7:
        return None
    name_cell = cells[0].strip()
    # 배팅순서 숫자 제거 (예: "1좌 이정후" → "좌 이정후")
    name_cell = re.sub(r"^\d+", "", name_cell).strip()
    pos = ""
    if name_cell and name_cell[0] in _POS_CHARS:
        pos = name_cell[0]
        name_cell = name_cell[1:].strip()
    try:
        return {
            "pos": pos,
            "name": name_cell,
            "ab":  _safe_int(cells[1]),
            "r":   _safe_int(cells[2]),
            "h":   _safe_int(cells[3]),
            "rbi": _safe_int(cells[4]),
            "bb":  _safe_int(cells[5]),
            "k":   _safe_int(cells[6]),
            "avg": cells[7] if len(cells) > 7 else "",
        }
    except Exception:
        return None


def _parse_pitcher_row(cells: list[str]) -> dict | None:
    """["{result}{name}", ip, h, r, er, bb, k, era] → dict"""
    if len(cells) < 7:
        return None
    name_cell = cells[0].strip()
    result = None
    for r in ("승", "패", "세", "홀"):
        if r in name_cell:
            result = r
            name_cell = name_cell.replace(r, "").strip()
            break
    try:
        ip_str = cells[1]
        ip_f = _parse_ip(ip_str)
        h  = _safe_int(cells[2])
        r_ = _safe_int(cells[3])
        er = _safe_int(cells[4])
        bb = _safe_int(cells[5])
        k  = _safe_int(cells[6])
        era_str = cells[7] if len(cells) > 7 else ""
        whip = round((bb + h) / ip_f, 2) if ip_f > 0 else 0.0
        return {
            "result": result,
            "name":   name_cell,
            "ip":     ip_str,
            "h":      h,
            "r":      r_,
            "er":     er,
            "bb":     bb,
            "k":      k,
            "era":    era_str,
            "whip":   whip,
        }
    except Exception:
        return None


def parse_boxscore_full(bx: dict) -> dict:
    """
    GetBoxScoreScroll 응답에서 타자/투수 테이블 전체 파싱.
    테이블 순서: 원정 타자 → 홈 타자 → 원정 투수 → 홈 투수 (통상적)
    반환: {awayBatters, homeBatters, awayPitchers, homePitchers,
           away_starter_era, home_starter_era, away_starter_whip, home_starter_whip}
    """
    batter_tables: list[list[dict]] = []
    pitcher_tables: list[list[dict]] = []

    for key in ("table1", "table2", "table3", "table4", "table5"):
        raw = bx.get(key)
        if not raw:
            continue
        headers, rows = _parse_table_with_headers(raw)
        ttype = _table_type(headers)
        if ttype == "pitcher":
            parsed = [p for p in (_parse_pitcher_row(r) for r in rows if r) if p]
            if parsed:
                pitcher_tables.append(parsed)
        elif ttype == "batter":
            parsed = [b for b in (_parse_batter_row(r) for r in rows if r) if b]
            if parsed:
                batter_tables.append(parsed)

    away_batters  = batter_tables[0]  if len(batter_tables) > 0 else []
    home_batters  = batter_tables[1]  if len(batter_tables) > 1 else []
    away_pitchers = pitcher_tables[0] if len(pitcher_tables) > 0 else []
    home_pitchers = pitcher_tables[1] if len(pitcher_tables) > 1 else []

    def _sp_stat(pitchers: list[dict], key: str) -> float:
        return _safe_float(pitchers[0].get(key, 0)) if pitchers else 0.0

    return {
        "awayBatters":       away_batters,
        "homeBatters":       home_batters,
        "awayPitchers":      away_pitchers,
        "homePitchers":      home_pitchers,
        "away_starter_era":  _sp_stat(away_pitchers, "era"),
        "home_starter_era":  _sp_stat(home_pitchers, "era"),
        "away_starter_whip": _sp_stat(away_pitchers, "whip"),
        "home_starter_whip": _sp_stat(home_pitchers, "whip"),
    }


def _extract_batter_pitcher_from_boxscore(box: dict) -> tuple[str, str]:
    """현재 투수/타자 이름만 빠르게 추출 (실시간 모드용)"""
    pitcher = ""
    batter = ""
    for key in ("table1", "table2", "table3", "table4", "table5", "tableEtc"):
        raw = box.get(key)
        if not raw:
            continue
        rows = _parse_json_table_rows(raw)
        for row in rows:
            if not row:
                continue
            if len(row) >= 2 and any(kw in row[0] for kw in ("투수", "선발")):
                if not pitcher:
                    pitcher = row[1]
            if len(row) >= 2 and any(kw in row[0] for kw in ("타자", "대타")):
                if not batter:
                    batter = row[1]
    return pitcher, batter


# ── 게임 레코드 빌드 ──────────────────────────────────────────────────────────

def build_game_record(raw: dict, prev: dict | None, sb: dict | None = None) -> dict:
    """
    GetKboGameList 단일 항목 → LiveGame Redis 포맷
      T = 원정(away), B = 홈(home)
    """
    g_id      = raw.get("G_ID", "")
    state_sc  = str(raw.get("GAME_STATE_SC", "1"))
    status    = STATE_MAP.get(state_sc, "scheduled")
    tb_sc     = raw.get("GAME_TB_SC", "T")
    inning_no = _safe_int(raw.get("GAME_INN_NO", 0))

    current_pitcher = (
        raw.get("T_P_NM", "") if tb_sc == "T" else raw.get("B_P_NM", "")
    ).strip()

    prev_wp      = (prev or {}).get("homeWP", 50)
    prev_history = list((prev or {}).get("wpaHistory", [50]))
    if len(prev_history) > 30:
        prev_history = prev_history[-30:]

    home_id = raw.get("HOME_ID", "")
    away_id = raw.get("AWAY_ID", "")

    away_rec = f"{_safe_int((sb or {}).get('A_W_CN'))}승 {_safe_int((sb or {}).get('A_L_CN'))}패"
    home_rec = f"{_safe_int((sb or {}).get('H_W_CN'))}승 {_safe_int((sb or {}).get('H_L_CN'))}패"

    return {
        "id":          _g_id_to_int(g_id),
        "gId":         g_id,
        "status":      status,
        "home":        TEAM_ID_MAP.get(home_id, raw.get("HOME_NM", home_id)),
        "away":        TEAM_ID_MAP.get(away_id, raw.get("AWAY_NM", away_id)),
        "homeId":      home_id,
        "awayId":      away_id,
        "homeScore":   _safe_int(raw.get("B_SCORE_CN", 0)),
        "awayScore":   _safe_int(raw.get("T_SCORE_CN", 0)),
        "inning":      f"{inning_no}회" if inning_no else "",
        "topBottom":   "top" if tb_sc == "T" else "bottom",
        "outs":        _safe_int(raw.get("OUT_CN", 0)),
        "bases": [
            _occupied(raw.get("B1_BAT_ORDER_NO")),
            _occupied(raw.get("B2_BAT_ORDER_NO")),
            _occupied(raw.get("B3_BAT_ORDER_NO")),
        ],
        "homeWP":              prev_wp,
        "wpaHistory":          prev_history,
        "currentPitcher":      current_pitcher,
        "currentBatter":       (prev or {}).get("currentBatter", ""),
        "absPitches":          (prev or {}).get("absPitches", []),
        "pitchClockRemaining": None,
        "strikeCount":         _safe_int(raw.get("STRIKE_CN")),
        "ballCount":           _safe_int(raw.get("BALL_CN")),
        "stadium":             raw.get("S_NM", ""),
        "awayStarter":         raw.get("T_PIT_P_NM", "").strip(),
        "homeStarter":         raw.get("B_PIT_P_NM", "").strip(),
        "winPitcher":          raw.get("W_PIT_P_NM", "").strip(),
        "losePitcher":         raw.get("L_PIT_P_NM", "").strip(),
        "savePitcher":         raw.get("SV_PIT_P_NM", "").strip(),
        "awayRecord":  away_rec if sb else (prev or {}).get("awayRecord", ""),
        "homeRecord":  home_rec if sb else (prev or {}).get("homeRecord", ""),
        "crowd":       (sb or {}).get("CROWD_CN", ""),
        "duration":    (sb or {}).get("USE_TM", ""),
        "inningScores":  (prev or {}).get("inningScores", []),
        "awayBatters":   (prev or {}).get("awayBatters", []),
        "homeBatters":   (prev or {}).get("homeBatters", []),
        "awayPitchers":  (prev or {}).get("awayPitchers", []),
        "homePitchers":  (prev or {}).get("homePitchers", []),
    }


# ── Redis 저장 ────────────────────────────────────────────────────────────────

async def save_games(r: aioredis.Redis, games: list[dict]) -> None:
    pipe = r.pipeline()
    ids: list[str] = []
    for game in games:
        key = f"game:{game['id']}"
        pipe.set(key, json.dumps(game, ensure_ascii=False))
        ids.append(str(game["id"]))
    if ids:
        pipe.delete("games:ids")
        pipe.rpush("games:ids", *ids)
        pipe.set("games:last_updated", datetime.now().isoformat())
    await pipe.execute()
    logger.info(f"Redis 저장: {len(games)}경기")


# ── 실시간 크롤 사이클 ────────────────────────────────────────────────────────

async def crawl_once(session: requests.Session, r: aioredis.Redis) -> None:
    loop = asyncio.get_running_loop()
    today = datetime.now().strftime("%Y%m%d")

    try:
        raw_list = await loop.run_in_executor(
            None, partial(api_get_game_list, session, today)
        )
    except Exception as e:
        logger.error(f"GetKboGameList 실패: {e}")
        return

    if not raw_list:
        logger.info("오늘 경기 없음")
        return

    async def enrich(raw: dict) -> tuple[dict, dict]:
        g_id = raw.get("G_ID", "")
        try:
            sb, bx = await asyncio.gather(
                loop.run_in_executor(None, partial(api_get_scoreboard, session, g_id, today)),
                loop.run_in_executor(None, partial(api_get_boxscore,   session, g_id, today)),
            )
            return sb, bx
        except Exception as e:
            logger.warning(f"상세 조회 실패 (G_ID={g_id}): {e}")
            return {}, {}

    detail_results = await asyncio.gather(*[enrich(raw) for raw in raw_list])

    games: list[dict] = []
    for raw, (sb, bx) in zip(raw_list, detail_results):
        numeric_id = _g_id_to_int(raw.get("G_ID", ""))
        prev_raw = await r.get(f"game:{numeric_id}")
        prev = json.loads(prev_raw) if prev_raw else None

        record = build_game_record(raw, prev, sb=sb or None)

        if bx:
            box_data = parse_boxscore_full(bx)
            # 박스스코어 데이터가 있으면 덮어씀
            for field in ("awayBatters", "homeBatters", "awayPitchers", "homePitchers"):
                if box_data[field]:
                    record[field] = box_data[field]
            # 현재 투수 보강 (기존 방식 fallback)
            if not record["currentPitcher"]:
                pitcher, batter = _extract_batter_pitcher_from_boxscore(bx)
                if pitcher:
                    record["currentPitcher"] = pitcher
                if batter:
                    record["currentBatter"] = batter

        games.append(record)

    await save_games(r, games)


# ── 배치 수집 (스케줄러용) ───────────────────────────────────────────────────

async def collect_recent_team_records(
    session: requests.Session,
    today: str,
    lookback: int = 20,
) -> dict[str, dict]:
    """
    지난 lookback일간 경기 결과로 팀별 최근 10경기 W/L 집계.
    반환: {team_id: {"recent_wins": int, "total": int}}
    """
    loop = asyncio.get_running_loop()
    dt = datetime.strptime(today, "%Y%m%d")
    dates = [(dt - timedelta(days=i)).strftime("%Y%m%d") for i in range(1, lookback + 1)]

    async def fetch_date(d: str) -> list[dict]:
        try:
            return await loop.run_in_executor(
                None, partial(api_get_game_list, session, d)
            )
        except Exception:
            return []

    all_results = await asyncio.gather(*[fetch_date(d) for d in dates])

    team_games: dict[str, list[bool]] = {}
    for raw_list in all_results:
        for raw in raw_list:
            if str(raw.get("GAME_STATE_SC", "1")) != "3":
                continue
            home_id    = raw.get("HOME_ID", "")
            away_id    = raw.get("AWAY_ID", "")
            home_score = _safe_int(raw.get("B_SCORE_CN", 0))
            away_score = _safe_int(raw.get("T_SCORE_CN", 0))

            for team_id, is_home in [(home_id, True), (away_id, False)]:
                if not team_id:
                    continue
                bucket = team_games.setdefault(team_id, [])
                if len(bucket) < 10:
                    win = (home_score > away_score) if is_home else (away_score > home_score)
                    bucket.append(win)

    return {
        tid: {"recent_wins": sum(1 for w in games if w), "total": len(games)}
        for tid, games in team_games.items()
    }


async def run_daily_batch(r: aioredis.Redis) -> list[dict]:
    """
    일일 배치 파이프라인:
      1) 팀별 최근 10경기 기록 수집
      2) 오늘/내일 경기 목록 수집
      3) 경기별 스코어보드 + 박스스코어 (ERA/WHIP 파싱 포함)
      4) Redis game:{date}:{gId} 저장 (TTL 48h)
    반환: 예측용 game_data 리스트
    """
    loop = asyncio.get_running_loop()
    today    = datetime.now().strftime("%Y%m%d")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y%m%d")

    session = _make_session()
    logger.info("[배치] 팀 최근 기록 + 경기 목록 수집 시작")

    async def get_game_list(d: str) -> tuple[str, list[dict]]:
        try:
            games = await loop.run_in_executor(
                None, partial(api_get_game_list, session, d)
            )
            return d, games
        except Exception as e:
            logger.warning(f"[배치] 경기 목록 실패 ({d}): {e}")
            return d, []

    # 팀 기록 + 오늘/내일 경기 목록 병렬 수집
    team_records_task = collect_recent_team_records(session, today)
    (team_records, (today_res, tomorrow_res)) = await asyncio.gather(
        team_records_task,
        asyncio.gather(get_game_list(today), get_game_list(tomorrow)),
    )

    today_date,    today_games    = today_res
    tomorrow_date, tomorrow_games = tomorrow_res
    all_raw = [(today_date, raw) for raw in today_games] + \
              [(tomorrow_date, raw) for raw in tomorrow_games]

    logger.info(f"[배치] 오늘 {len(today_games)}경기 / 내일 {len(tomorrow_games)}경기")

    # 경기별 스코어보드 + 박스스코어 병렬 수집
    async def enrich(date: str, raw: dict) -> tuple[str, dict, dict, dict]:
        g_id = raw.get("G_ID", "")
        try:
            sb, bx = await asyncio.gather(
                loop.run_in_executor(None, partial(api_get_scoreboard, session, g_id, date)),
                loop.run_in_executor(None, partial(api_get_boxscore,   session, g_id, date)),
            )
        except Exception as e:
            logger.warning(f"[배치] 상세 조회 실패 ({g_id}): {e}")
            sb, bx = {}, {}
        return date, raw, sb or {}, bx or {}

    enriched_list = await asyncio.gather(*[enrich(d, raw) for d, raw in all_raw])

    prediction_games: list[dict] = []
    pipe = r.pipeline()

    for date, raw, sb, bx in enriched_list:
        g_id    = raw.get("G_ID", "")
        home_id = raw.get("HOME_ID", "")
        away_id = raw.get("AWAY_ID", "")

        # 실시간 캐시에서 이전 데이터 가져오기
        numeric_id = _g_id_to_int(g_id)
        prev_raw = await r.get(f"game:{numeric_id}")
        prev = json.loads(prev_raw) if prev_raw else None

        record = build_game_record(raw, prev, sb=sb or None)
        record["date"] = date

        # 박스스코어 파싱 (ERA/WHIP + 타자/투수 스탯)
        if bx:
            box_data = parse_boxscore_full(bx)
            for field in ("awayBatters", "homeBatters", "awayPitchers", "homePitchers"):
                if box_data[field]:
                    record[field] = box_data[field]
            record["away_era"]  = box_data["away_starter_era"]
            record["home_era"]  = box_data["home_starter_era"]
            record["away_whip"] = box_data["away_starter_whip"]
            record["home_whip"] = box_data["home_starter_whip"]
        else:
            record.setdefault("away_era", 0.0)
            record.setdefault("home_era", 0.0)
            record.setdefault("away_whip", 0.0)
            record.setdefault("home_whip", 0.0)

        # 팀 최근 기록
        away_rec = team_records.get(away_id, {})
        home_rec = team_records.get(home_id, {})
        record["away_recent_wins"] = away_rec.get("recent_wins", 5)
        record["home_recent_wins"] = home_rec.get("recent_wins", 5)

        # 상대 전적 (시즌 전적 scoreboard에서)
        h2h_away = _safe_int((sb or {}).get("A_W_CN", 0))
        h2h_home = _safe_int((sb or {}).get("H_W_CN", 0))
        record["h2h_away_wins"] = h2h_away
        record["h2h_home_wins"] = h2h_home
        record["h2h_summary"] = (
            f"{record['away']} {h2h_away}승 {record['home']} {h2h_home}승"
            if h2h_away + h2h_home > 0 else "기록 없음"
        )

        # Redis game:{date}:{gId} — TTL 48시간
        pipe.set(
            f"game:{date}:{g_id}",
            json.dumps(record, ensure_ascii=False),
            ex=86400 * 2,
        )
        prediction_games.append(record)

    await pipe.execute()
    logger.info(f"[배치] {len(prediction_games)}경기 저장 완료 (game:{{date}}:{{gId}})")
    return prediction_games


# ── 순위 크롤러 ──────────────────────────────────────────────────────────────

def api_get_standings(session: requests.Session) -> list[dict]:
    resp = session.post(
        STANDING_URL,
        data={"leId": "1", "srId": "0"},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    # 응답이 {"list": [...]} 또는 직접 배열
    if isinstance(data, list):
        return data
    return data.get("list", data.get("game", []))


def _parse_standing_item(item: dict | list, rank: int) -> dict | None:
    """KBO 순위 항목 파싱 (dict 또는 HTML 셀 리스트 모두 처리)"""
    try:
        if isinstance(item, list):
            # HTML 테이블 행 파싱
            cells = [BeautifulSoup(str(c), "lxml").get_text(strip=True) for c in item]
            if len(cells) < 7:
                return None
            return {
                "rank":     rank,
                "team":     cells[1] if len(cells) > 1 else "",
                "games":    _safe_int(cells[2]),
                "wins":     _safe_int(cells[3]),
                "losses":   _safe_int(cells[4]),
                "draws":    _safe_int(cells[5]),
                "win_pct":  _safe_float(cells[6]),
                "gb":       cells[7] if len(cells) > 7 else "-",
                "recent10": cells[8] if len(cells) > 8 else "",
                "streak":   cells[9] if len(cells) > 9 else "",
            }
        else:
            # JSON 객체 파싱
            team_id = item.get("TEAM_ID", item.get("teamId", ""))
            team_nm = item.get("TEAM_NM", item.get("teamName", ""))
            team    = TEAM_ID_MAP.get(team_id, team_nm)
            return {
                "rank":     _safe_int(item.get("RANK", item.get("rank", rank))),
                "team":     team,
                "games":    _safe_int(item.get("GAME_CN", item.get("games", 0))),
                "wins":     _safe_int(item.get("W_CN",    item.get("wins", 0))),
                "losses":   _safe_int(item.get("L_CN",    item.get("losses", 0))),
                "draws":    _safe_int(item.get("D_CN",    item.get("draws", 0))),
                "win_pct":  _safe_float(item.get("W_RATE", item.get("win_pct", 0.0))),
                "gb":       str(item.get("GAME_DIFF", item.get("gb", "-"))),
                "recent10": item.get("RECENT10", item.get("recent10", "")),
                "streak":   item.get("STREAK", item.get("streak", "")),
            }
    except Exception:
        return None


async def fetch_standings() -> list[dict]:
    """KBO 팀 순위 반환 (Redis 우선, 실패 시 크롤링)"""
    loop = asyncio.get_running_loop()
    session = _make_session()
    try:
        raw_list = await loop.run_in_executor(
            None, partial(api_get_standings, session)
        )
        result = []
        for i, item in enumerate(raw_list, 1):
            parsed = _parse_standing_item(item, i)
            if parsed and parsed.get("team"):
                result.append(parsed)
        if result:
            result.sort(key=lambda x: x["rank"])
            logger.info(f"순위 조회 완료: {len(result)}팀")
            return result
    except Exception as e:
        logger.warning(f"순위 조회 실패: {e}")
    return []


# ── 실시간 메인 루프 ─────────────────────────────────────────────────────────

async def run() -> None:
    try:
        r = aioredis.from_url(REDIS_URL, decode_responses=True)
        await r.ping()
        logger.info("Redis 연결 성공")
    except Exception:
        logger.error("Redis 연결 실패")
        return

    session = _make_session()
    logger.info(f"KBO 크롤러 시작 ({SCRAPE_INTERVAL}초 간격)")

    while True:
        try:
            await crawl_once(session, r)
        except Exception as e:
            logger.error(f"크롤 사이클 오류: {e}")
        await asyncio.sleep(SCRAPE_INTERVAL)


if __name__ == "__main__":
    asyncio.run(run())
