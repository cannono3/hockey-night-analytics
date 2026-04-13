const BASE = "https://api-web.nhle.com/v1";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function get<T>(path: string, revalidate = 60): Promise<T> {
  // Retry up to 4 times with exponential backoff on 429
  let delay = 1500;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate } });
    if (res.ok) return res.json();
    if (res.status === 429) {
      if (attempt < 3) {
        await sleep(delay);
        delay *= 2;
        continue;
      }
    }
    throw new Error(`NHL API error: ${res.status} ${path}`);
  }
  throw new Error(`NHL API rate limit exceeded: ${path}`);
}

// ── Standings ────────────────────────────────────────────────────────────────
export async function getStandings() {
  const data = await get<{ standings: StandingTeam[] }>("/standings/now");
  return data.standings;
}

export interface StandingTeam {
  teamAbbrev: { default: string };
  teamName: { default: string };
  teamCommonName: { default: string };
  teamLogo: string;
  conferenceName: string;
  divisionName: string;
  points: number;
  wins: number;
  losses: number;
  otLosses: number;
  gamesPlayed: number;
  goalFor: number;
  goalAgainst: number;
  goalDifferential: number;
  streakCode: string;
  streakCount: number;
  l10Wins: number;
  l10Losses: number;
  l10OtLosses: number;
  pointPctg: number;
  regulationWins: number;
  divisionSequence: number;
  wildcardSequence: number;
}

// ── League leaders ───────────────────────────────────────────────────────────
export async function getLeagueLeaders(category: string, limit = 10) {
  const data = await get<Record<string, LeagueLeader[]>>(
    `/skater-stats-leaders/current?categories=${category}&limit=${limit}`,
    3600 // cache 1 hour — leaders don't change by the minute
  );
  return data[category] ?? [];
}

export interface LeagueLeader {
  id: number;
  firstName: { default: string };
  lastName: { default: string };
  headshot: string;
  teamAbbrev: string;
  teamLogo: string;
  position: string;
  value: number;
}

// ── Team stats ───────────────────────────────────────────────────────────────
export async function getTeamStats(abbrev: string) {
  return get<{ season: number; gameType: number; skaters: Skater[]; goalies: Goalie[] }>(
    `/club-stats/${abbrev}/now`
  );
}

export interface Skater {
  playerId: number;
  headshot: string;
  firstName: { default: string };
  lastName: { default: string };
  positionCode: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  penaltyMinutes: number;
  powerPlayGoals: number;
  shorthandedGoals: number;
  gameWinningGoals: number;
  shots: number;
  shootingPctg: number;
  avgTimeOnIcePerGame: number;
  faceoffWinPctg: number;
}

export interface Goalie {
  playerId: number;
  headshot: string;
  firstName: { default: string };
  lastName: { default: string };
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  goalsAgainstAvg: number;
  savePctg: number;
  shutouts: number;
}

// ── Team schedule / results ──────────────────────────────────────────────────
export async function getTeamSchedule(abbrev: string, season = "now") {
  const data = await get<{ games: ScheduleGame[] }>(
    `/club-schedule-season/${abbrev}/${season}`,
    300 // 5 min cache — schedule doesn't change often
  );
  return data.games.filter((g) => g.gameType === 2); // regular season only
}

export interface ScheduleGame {
  id: number;
  gameDate: string;
  gameState: string;
  gameType: number;
  awayTeam: GameTeam;
  homeTeam: GameTeam;
}

export interface GameTeam {
  abbrev: string;
  commonName: { default: string };
  logo: string;
  score?: number;
}

// ── Player career stats ──────────────────────────────────────────────────────
export async function getPlayerCareer(playerId: number) {
  return get<PlayerCareer>(`/player/${playerId}/landing`);
}

export interface PlayerCareer {
  playerId: number;
  firstName: { default: string };
  lastName: { default: string };
  headshot: string;
  teamAbbrev: string;
  teamLogo: string;
  position: string;
  sweaterNumber: number;
  heightInInches: number;
  weightInPounds: number;
  birthDate: string;
  birthCity: { default: string };
  birthCountry: string;
  featuredStats: {
    regularSeason: {
      subSeason: SeasonStats;
      career: SeasonStats;
    };
  };
  seasonTotals: SeasonTotal[];
}

export interface SeasonStats {
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  gameWinningGoals?: number;
  shots?: number;
  shootingPctg?: number;
  powerPlayGoals?: number;
  powerPlayPoints?: number;
}

export interface SeasonTotal {
  season: number;
  gameTypeId: number;
  leagueAbbrev: string;
  teamName: { default: string };
  sequence: number;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  gameWinningGoals?: number;
  shots?: number;
  shootingPctg?: number;
  powerPlayGoals?: number;
  powerPlayPoints?: number;
  avgToi?: string;
}

// ── Today's games ────────────────────────────────────────────────────────────
export async function getTodayGames() {
  const data = await get<{ games: TodayGame[] }>("/score/now");
  return data.games ?? [];
}

// ── Last night's scores ───────────────────────────────────────────────────────
export async function getLastNightScores() {
  // Use Eastern time (UTC-4 EDT / UTC-5 EST) so "yesterday" doesn't flip to today
  // after 8 PM ET when UTC rolls to the next date
  const etOffsetMs = 4 * 60 * 60 * 1000; // EDT (close enough year-round)
  const nowET = new Date(Date.now() - etOffsetMs);
  const yesterday = new Date(nowET);
  yesterday.setDate(yesterday.getDate() - 1);
  const date = yesterday.toISOString().slice(0, 10);
  const data = await get<{ games: LastNightGame[] }>(`/score/${date}`);
  // Only return completed games — filters out live games that bleed across midnight
  return (data.games ?? []).filter(
    (g) => g.gameType === 2 && (g.gameState === "OFF" || g.gameState === "FINAL")
  );
}

export interface GoalEvent {
  period: number;
  timeInPeriod: string;
  firstName: { default: string };
  lastName: { default: string };
  teamAbbrev: string;
  goalsToDate: number;
  strength: string;
  goalModifier: string;
  mugshot: string;
  assists: { name: { default: string } }[];
  awayScore: number;
  homeScore: number;
}

export interface LastNightGame {
  id: number;
  gameType: number;
  gameState: string;
  gameDate: string;
  awayTeam: { abbrev: string; name: { default: string }; score: number; sog: number; logo: string };
  homeTeam: { abbrev: string; name: { default: string }; score: number; sog: number; logo: string };
  gameOutcome?: { lastPeriodType: string };
  goals: GoalEvent[];
}

// ── Bulk team stats for model ────────────────────────────────────────────────
export async function getTeamStatsBulk(abbrevs: string[]) {
  const unique = [...new Set(abbrevs)];
  const results = await Promise.all(
    unique.map(async (abbrev) => {
      try {
        const data = await getTeamStats(abbrev);
        return { abbrev, skaters: data.skaters, goalies: data.goalies };
      } catch {
        return { abbrev, skaters: [], goalies: [] };
      }
    })
  );
  return Object.fromEntries(results.map((r) => [r.abbrev, r]));
}

// ── Player streaks (last N games from team schedule) ─────────────────────────
export async function getTeamRecentGames(abbrev: string, count = 10) {
  const games = await getTeamSchedule(abbrev);
  return games
    .filter((g) => g.gameState === "OFF" || g.gameState === "FINAL")
    .slice(-count);
}

export interface TodayGame {
  id: number;
  gameDate: string;
  gameState: string;
  awayTeam: { abbrev: string; commonName: { default: string }; logo: string; score?: number };
  homeTeam: { abbrev: string; commonName: { default: string }; logo: string; score?: number };
  startTimeUTC: string;
  periodDescriptor?: { number: number; periodType: string };
  clock?: { timeRemaining: string; inIntermission: boolean };
}
