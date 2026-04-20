"""
승리 확률 계산기 — 로지스틱 회귀 모델
──────────────────────────────────────
입력 (game_data dict):
  away_era          float  원정 선발 ERA
  home_era          float  홈 선발 ERA
  away_recent_wins  int    원정팀 최근 10경기 승수
  home_recent_wins  int    홈팀 최근 10경기 승수
  h2h_away_wins     int    상대 전적 원정 승수 (시즌)
  h2h_home_wins     int    상대 전적 홈 승수 (시즌)

출력:
  {"away_win_pct": 40, "home_win_pct": 60, "factors": [...]}
"""

import math

# 로지스틱 계수
_HOME_ADV   = 0.22   # 홈 어드밴티지 고정 보정 (~+5.5%)
_ERA_W      = 0.11   # ERA 1점 당 로짓 변화
_FORM_W     = 0.80   # 최근 10경기 승률(0~1) 차이 당 로짓
_H2H_W      = 0.35   # H2H 승률(0~1) 차이 당 로짓
_DEFAULT_ERA = 4.50  # ERA 미입력 시 기본값


def _logit_to_pct(logit: float) -> int:
    return round(100 / (1 + math.exp(-logit)))


def calculate_wp(data: dict) -> dict:
    """
    로지스틱 회귀로 홈팀 승리 확률 계산.
    score > 0 → 홈팀 유리, score < 0 → 원정팀 유리.
    """
    score = 0.0
    factors: list[dict] = []

    # ── 홈 어드밴티지 ─────────────────────────────────────────────────────────
    score += _HOME_ADV
    factors.append({
        "label": "홈 어드밴티지",
        "impact_pct": round(_logit_to_pct(_HOME_ADV) - 50),
        "side": "home",
    })

    # ── 선발 ERA ──────────────────────────────────────────────────────────────
    away_era = float(data.get("away_era") or _DEFAULT_ERA)
    home_era = float(data.get("home_era") or _DEFAULT_ERA)
    era_diff = away_era - home_era          # 양수 → 홈 유리
    era_logit = era_diff * _ERA_W
    score += era_logit

    if abs(era_diff) >= 0.30:
        side = "home" if era_diff > 0 else "away"
        factors.append({
            "label": f"선발 ERA ({data.get('homeStarter') or '홈'} {home_era:.2f} / {data.get('awayStarter') or '원정'} {away_era:.2f})",
            "impact_pct": abs(round(era_logit * 25)),
            "side": side,
        })

    # ── 최근 10경기 폼 ────────────────────────────────────────────────────────
    away_w = int(data.get("away_recent_wins") or 5)
    home_w = int(data.get("home_recent_wins") or 5)
    form_diff = (home_w - away_w) / 10      # -1.0 ~ +1.0
    form_logit = form_diff * _FORM_W
    score += form_logit

    if abs(home_w - away_w) >= 2:
        side = "home" if home_w > away_w else "away"
        label_team = data.get("home") if side == "home" else data.get("away")
        factors.append({
            "label": f"최근 10경기 {label_team} {max(home_w, away_w)}승",
            "impact_pct": abs(round(form_logit * 25)),
            "side": side,
        })

    # ── 상대 전적 ─────────────────────────────────────────────────────────────
    h2h_away = int(data.get("h2h_away_wins") or 0)
    h2h_home = int(data.get("h2h_home_wins") or 0)
    h2h_total = h2h_away + h2h_home
    if h2h_total >= 3:
        h2h_diff = (h2h_home / h2h_total) - 0.5
        h2h_logit = h2h_diff * _H2H_W
        score += h2h_logit
        if abs(h2h_diff) >= 0.10:
            side = "home" if h2h_diff > 0 else "away"
            factors.append({
                "label": f"상대 전적 {data.get('away', '원정')} {h2h_away}승 {data.get('home', '홈')} {h2h_home}승",
                "impact_pct": abs(round(h2h_logit * 25)),
                "side": side,
            })

    home_pct = _logit_to_pct(score)
    home_pct = max(5, min(95, home_pct))   # 5~95% 범위 제한
    away_pct = 100 - home_pct

    return {
        "away_win_pct": away_pct,
        "home_win_pct": home_pct,
        "factors": factors,
    }
