import {
  CourseConfig,
  Game,
  HoleConfig,
  Player,
  PlayerHandicapInfo,
  PlayerHoleSummary,
  PlayerRound,
  PlayerRoundSummary,
} from './types';

/**
 * Calculate Course Handicap from World Handicap System formula:
 * Course Handicap = Handicap Index × (Slope Rating / 113) + (Course Rating - Course Par)
 */
export function calculateCourseHandicap(
  handicapIndex: number,
  slope: number,
  rating: number,
  par: number
): number {
  const raw = handicapIndex * (slope / 113) + (rating - par);
  return Math.round(raw);
}

/**
 * Given a course handicap, return how many extra strokes each hole receives.
 * A player with courseHandicap 18 gets 1 stroke on every hole.
 * A player with courseHandicap 36 gets 2 strokes on every hole.
 * A player with courseHandicap 5 gets 1 stroke on holes with strokeIndex 1–5.
 */
export function getExtraStrokesPerHole(
  courseHandicap: number,
  holes: HoleConfig[]
): number[] {
  return holes.map((hole) => {
    if (courseHandicap <= 0) return 0;
    const fullRounds = Math.floor(courseHandicap / 18);
    const remainder = courseHandicap % 18;
    return fullRounds + (hole.strokeIndex <= remainder ? 1 : 0);
  });
}

/**
 * Calculate Stableford points for a single hole.
 * Points = par + extraStrokes - strokes + 2
 * (i.e. 2 for net par, 1 for bogey, 3 for birdie, etc.)
 * Minimum 0 points.
 */
export function stablefordPoints(
  strokes: number,
  par: number,
  extraStrokes: number
): number {
  const points = par + extraStrokes - strokes + 2;
  return Math.max(0, points);
}

/**
 * Build full handicap info for each player.
 */
export function buildHandicapInfo(
  players: Player[],
  course: CourseConfig
): PlayerHandicapInfo[] {
  return players.map((player) => {
    const courseHandicap = calculateCourseHandicap(
      player.handicap,
      course.slope,
      course.rating,
      course.par
    );
    const extraStrokes = getExtraStrokesPerHole(courseHandicap, course.holes);
    return { playerId: player.id, courseHandicap, extraStrokes };
  });
}

/**
 * Build a complete summary for one player's round.
 */
export function buildPlayerRoundSummary(
  player: Player,
  round: PlayerRound,
  course: CourseConfig,
  handicapInfo: PlayerHandicapInfo
): PlayerRoundSummary {
  let totalStrokes = 0;
  let totalStableford = 0;
  let totalWolfPoints = 0;
  let holesPlayed = 0;
  let hasNullStrokes = false;

  const holes: PlayerHoleSummary[] = course.holes.map((holeConfig, idx) => {
    const strokes = round.scores[idx]?.strokes ?? null;
    const wolfPoints = round.scores[idx]?.wolfPoints ?? null;
    const extraStrokes = handicapInfo.extraStrokes[idx] ?? 0;
    const netStrokes = strokes !== null ? strokes - extraStrokes : null;
    const points =
      strokes !== null
        ? stablefordPoints(strokes, holeConfig.par, extraStrokes)
        : null;

    if (strokes !== null) {
      totalStrokes += strokes;
      totalStableford += points ?? 0;
      holesPlayed++;
    } else {
      hasNullStrokes = true;
    }

    if (wolfPoints !== null) {
      totalWolfPoints += wolfPoints;
    }

    return {
      hole: holeConfig.hole,
      par: holeConfig.par,
      strokeIndex: holeConfig.strokeIndex,
      strokes,
      extraStrokes,
      netStrokes,
      stablefordPoints: points,
      wolfPoints,
    };
  });

  return {
    player,
    courseHandicap: handicapInfo.courseHandicap,
    holes,
    totalStrokes: hasNullStrokes && holesPlayed === 0 ? null : totalStrokes,
    totalStableford,
    totalWolfPoints,
    holesPlayed,
  };
}

/**
 * Build summaries for all players in a game.
 */
export function buildGameSummaries(game: Game): PlayerRoundSummary[] {
  const handicapInfos = buildHandicapInfo(game.players, game.course);
  return game.players.map((player) => {
    const round = game.rounds.find((r) => r.playerId === player.id)!;
    const handicapInfo = handicapInfos.find((h) => h.playerId === player.id)!;
    return buildPlayerRoundSummary(player, round, game.course, handicapInfo);
  });
}

/**
 * Default 18 holes with standard stroke indexes.
 */
export function defaultHoles(): HoleConfig[] {
  // Standard stroke index distribution
  const strokeIndexes = [1, 10, 3, 12, 5, 14, 7, 16, 9, 2, 11, 4, 13, 6, 15, 8, 17, 18];
  const pars = [4, 5, 4, 3, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 3, 4, 5, 4];
  return Array.from({ length: 18 }, (_, i) => ({
    hole: i + 1,
    par: pars[i],
    strokeIndex: strokeIndexes[i],
  }));
}

/**
 * Generate a unique ID.
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Format a score relative to par (e.g. E, +3, -1).
 */
export function formatScoreToPar(strokes: number, par: number): string {
  const diff = strokes - par;
  if (diff === 0) return 'E';
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
}

/**
 * Get score label for display (Eagle, Birdie, Par, Bogey, etc.)
 */
export function getScoreLabel(strokes: number, par: number): string {
  const diff = strokes - par;
  if (diff <= -3) return 'Albatross';
  if (diff === -2) return 'Eagle';
  if (diff === -1) return 'Birdie';
  if (diff === 0) return 'Par';
  if (diff === 1) return 'Bogey';
  if (diff === 2) return 'Double';
  if (diff === 3) return 'Triple';
  return `+${diff}`;
}

/**
 * Get score color for display.
 */
export function getScoreColor(strokes: number | null, par: number): string {
  if (strokes === null) return '#9CA3AF';
  const diff = strokes - par;
  if (diff <= -2) return '#F59E0B'; // eagle+ = gold
  if (diff === -1) return '#16A34A'; // birdie = green
  if (diff === 0) return '#2563EB'; // par = blue
  if (diff === 1) return '#6B7280'; // bogey = grey
  return '#DC2626'; // double+ = red
}