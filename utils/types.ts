// Types for the Golf Scorer app

export interface Player {
  id: string;
  name: string;
  handicap: number;
}

export interface HoleConfig {
  hole: number;       // 1–18
  par: number;        // 3, 4, or 5
  strokeIndex: number; // 1–18 (difficulty ranking)
}

export interface CourseConfig {
  name: string;
  par: number;         // total course par (usually 72)
  rating: number;      // course rating (e.g. 70.1)
  slope: number;       // slope rating (e.g. 113)
  holes: HoleConfig[];
}

export interface HoleScore {
  strokes: number | null; // null = not yet entered
}

export interface PlayerRound {
  playerId: string;
  scores: HoleScore[]; // index 0 = hole 1, length 18
}

export interface Game {
  id: string;
  date: string;           // ISO date string
  course: CourseConfig;
  players: Player[];
  rounds: PlayerRound[];
  completed: boolean;
}

// Derived / calculated types
export interface PlayerHandicapInfo {
  playerId: string;
  courseHandicap: number;         // calculated from slope/rating/handicap
  extraStrokes: number[];         // per hole, 0 or 1 (or 2 for very high handicaps)
}

export interface PlayerHoleSummary {
  hole: number;
  par: number;
  strokeIndex: number;
  strokes: number | null;
  extraStrokes: number;
  netStrokes: number | null;
  stablefordPoints: number | null;
}

export interface PlayerRoundSummary {
  player: Player;
  courseHandicap: number;
  holes: PlayerHoleSummary[];
  totalStrokes: number | null;
  totalStableford: number;
  holesPlayed: number;
}
