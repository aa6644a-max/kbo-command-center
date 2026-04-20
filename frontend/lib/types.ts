export type GameStatus = 'scheduled' | 'live' | 'done';

export type TeamCode =
  | 'LG' | 'KT' | 'SSG' | 'NC' | '두산'
  | 'KIA' | '롯데' | '삼성' | '한화' | '키움';

export interface InningScore {
  inning: number;
  away: number | null;
  home: number | null;
}

export interface BatterStat {
  name: string;
  pos: string;
  ab: number;
  r: number;
  h: number;
  rbi: number;
  bb: number;
  k: number;
  avg: string;
}

export interface PitcherStat {
  name: string;
  result?: 'W' | 'L' | 'S' | 'H' | '';
  ip: string;
  h: number;
  r: number;
  er: number;
  bb: number;
  k: number;
  era: string;
}

export interface LiveGame {
  id: number;
  gId?: string;
  status: GameStatus;
  home: TeamCode;
  away: TeamCode;
  homeScore: number;
  awayScore: number;
  inning: string;
  topBottom: 'top' | 'bottom';
  outs: number;
  bases: [boolean, boolean, boolean];
  homeWP: number;
  wpaHistory: number[];
  currentPitcher: string;
  currentBatter: string;
  // 투수 정보
  awayStarter?: string;
  homeStarter?: string;
  winPitcher?: string;
  losePitcher?: string;
  savePitcher?: string;
  // 팀 기록
  awayRecord?: string;   // "10승 9패"
  homeRecord?: string;
  // 경기장/관중
  stadium?: string;
  crowd?: string;
  duration?: string;
  // 이닝별 점수
  inningScores?: InningScore[];
  // 박스스코어
  awayBatters?: BatterStat[];
  homeBatters?: BatterStat[];
  awayPitchers?: PitcherStat[];
  homePitchers?: PitcherStat[];
  // ABS
  absPitches?: AbsPitch[];
  pitchClockRemaining?: number;
  strikeCount?: number;
  ballCount?: number;
}

export interface AbsPitch {
  x: number;
  z: number;
  result: 'strike' | 'ball' | 'hit' | 'swinging_strike';
  velocity: number;
  pitchType: 'FF' | 'SL' | 'CH' | 'CB' | 'CT';
}

// 팀 컬러 팔레트
export const TEAM_COLOR: Record<string, string> = {
  'LG':  '#C8112A',
  '삼성': '#1A5AA5',
  'KIA': '#EA0029',
  'KT':  '#1A1A1A',
  'SSG': '#CE0E2D',
  'NC':  '#071D5B',
  '두산': '#131230',
  '롯데': '#041E42',
  '한화': '#FF6600',
  '키움': '#820024',
};

export const TEAM_ABBR: Record<string, string> = {
  'LG': 'LG', '삼성': 'SS', 'KIA': 'HT', 'KT': 'KT',
  'SSG': 'SK', 'NC': 'NC', '두산': 'OB', '롯데': 'LT',
  '한화': 'HH', '키움': 'WO',
};

// ── 예측 전용 타입 ──────────────────────────────────────────────────────────

export interface WpFactor {
  label: string;
  impact_pct: number;
  side: 'home' | 'away';
}

export interface PredictionGame extends Omit<LiveGame, 'status'> {
  status: GameStatus;
  date: string;            // YYYYMMDD
  away_win_pct: number;
  home_win_pct: number;
  wp_factors: WpFactor[];
  ai_comment: string;
  away_era: number;
  home_era: number;
  away_whip: number;
  home_whip: number;
  away_recent_wins: number;
  home_recent_wins: number;
  h2h_summary: string;
}
