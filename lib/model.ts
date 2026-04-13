import { StandingTeam, Skater, Goalie } from "./nhl";

// ── League baselines ─────────────────────────────────────────────────────────
// NHL 2024-25 season averages
export const LEAGUE_AVG_SHOOTING = 0.094; // ~9.4%
export const LEAGUE_AVG_SAVE_PCT = 0.896; // ~89.6%
export const LEAGUE_AVG_PDO = LEAGUE_AVG_SHOOTING + LEAGUE_AVG_SAVE_PCT; // ~0.990

// Teams the public systematically overvalues — lines shift 1–3% vs fair
const PUBLIC_DARLINGS = new Set([
  "BOS", "TOR", "NYR", "MTL", "EDM", "VGK", "COL", "PIT", "CHI", "DET",
]);

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface TeamMetrics {
  abbrev: string;
  // Season quality
  pointPctg: number;
  regWinPct: number;
  gdPerGame: number;
  // Luck indicators (PDO)
  shootingPct: number;
  savePct: number;
  pdo: number;
  pdoDeviation: number; // vs league avg; positive = running lucky
  // Shot share (Corsi proxy)
  shotsForPerGame: number;
  estShotsAgainstPerGame: number;
  shotSharePct: number; // higher = controlling play
  // Special teams
  ppGoalsPerGame: number;
  // Recent form
  l10WinPct: number;
  l10Trend: number; // vs season point%: positive = improving
  // Context
  isPublicDarling: boolean;
  gamesPlayed: number;
}

export interface ModelSignal {
  label: string;
  favors: "home" | "away" | "neutral";
  strength: "strong" | "moderate" | "weak";
  description: string;
}

export interface PickAnalysis {
  homeWinProb: number; // 0–1, PDO-adjusted
  awayWinProb: number;
  confidence: "strong" | "lean" | "low";
  signals: ModelSignal[];
  keyReasons: string[];
}

// ── Build team metrics from raw API data ─────────────────────────────────────

export function buildTeamMetrics(
  abbrev: string,
  standing: StandingTeam,
  skaters: Skater[],
  goalies: Goalie[]
): TeamMetrics {
  const gp = standing.gamesPlayed;

  // Team shooting % — sum of all skater goals / shots
  const totalGoals = skaters.reduce((s, p) => s + p.goals, 0);
  const totalShots = skaters.reduce((s, p) => s + p.shots, 0);
  const shootingPct =
    totalShots > 60 ? totalGoals / totalShots : LEAGUE_AVG_SHOOTING;

  // Team SV% — weighted by each goalie's games played
  // Filter out goalies with no games or null/undefined savePctg (backups who haven't played)
  const validGoalies = goalies.filter(
    (g) => g.gamesPlayed > 0 && g.savePctg != null && isFinite(g.savePctg) && g.savePctg > 0
  );
  const totalGoalieGP = validGoalies.reduce((s, g) => s + g.gamesPlayed, 0);
  const savePct =
    totalGoalieGP > 0
      ? validGoalies.reduce(
          (s, g) => s + g.savePctg * (g.gamesPlayed / totalGoalieGP),
          0
        )
      : LEAGUE_AVG_SAVE_PCT;

  // PDO = shooting% + save% (league avg ~0.990)
  const pdo = shootingPct + savePct;
  const pdoDeviation = pdo - LEAGUE_AVG_PDO;

  // Shots for per game (skater totals ÷ team games)
  const shotsForPerGame = gp > 0 ? totalShots / gp : 28;

  // Estimate shots against: goalsAgainst ÷ league avg shooting%
  // (opponent goals scored on us ÷ how efficiently opponents shoot)
  const estShotsAgainstPerGame =
    gp > 0 ? standing.goalAgainst / gp / LEAGUE_AVG_SHOOTING : 28;

  // Shot share — proxy for Corsi%, the best predictor of future win rate
  const shotSharePct =
    shotsForPerGame / Math.max(shotsForPerGame + estShotsAgainstPerGame, 1);

  // Power play goals per game
  const totalPPGoals = skaters.reduce((s, p) => s + p.powerPlayGoals, 0);
  const ppGoalsPerGame = gp > 0 ? totalPPGoals / gp : 0;

  // Recent form
  const l10WinPct = standing.l10Wins / 10;
  const l10Trend = l10WinPct - standing.pointPctg; // positive = heating up

  return {
    abbrev,
    pointPctg: standing.pointPctg,
    regWinPct: gp > 0 ? standing.regulationWins / gp : 0,
    gdPerGame: gp > 0 ? standing.goalDifferential / gp : 0,
    shootingPct,
    savePct,
    pdo,
    pdoDeviation,
    shotsForPerGame,
    estShotsAgainstPerGame,
    shotSharePct,
    ppGoalsPerGame,
    l10WinPct,
    l10Trend,
    isPublicDarling: PUBLIC_DARLINGS.has(abbrev),
    gamesPlayed: gp,
  };
}

// ── Core model ───────────────────────────────────────────────────────────────

export function runModel(home: TeamMetrics, away: TeamMetrics): PickAnalysis {
  const signals: ModelSignal[] = [];
  const keyReasons: string[] = [];

  // ── Factor 1: PDO Regression (most important — 30% weight) ──────────────
  // Luck normalizes over a full season. High PDO = overvalued. Low PDO = undervalued.
  // Each 1% PDO deviation = ~0.5% real win rate swing (conservative estimate)
  const homePDOScore = -home.pdoDeviation * 0.5; // positive = home is unlucky = boost
  const awayPDOScore = -away.pdoDeviation * 0.5;
  const pdoDelta = Math.abs(home.pdoDeviation - away.pdoDeviation);

  if (pdoDelta > 0.01) {
    const luckyTeam = home.pdoDeviation > away.pdoDeviation ? home : away;
    const unluckyTeam = home.pdoDeviation > away.pdoDeviation ? away : home;
    const favors = unluckyTeam.abbrev === home.abbrev ? "home" : "away" as const;
    const strength =
      pdoDelta > 0.035 ? "strong" : pdoDelta > 0.018 ? "moderate" : "weak";

    signals.push({
      label: "PDO Regression",
      favors,
      strength,
      description: `${luckyTeam.abbrev} PDO ${(luckyTeam.pdo * 100).toFixed(1)}% (${luckyTeam.pdoDeviation > 0 ? "+" : ""}${(luckyTeam.pdoDeviation * 100).toFixed(1)}% vs avg) — regression likely. ${unluckyTeam.abbrev} PDO ${(unluckyTeam.pdo * 100).toFixed(1)}% — underperforming luck.`,
    });

    if (strength !== "weak") {
      keyReasons.push(
        `${luckyTeam.abbrev} shooting ${(luckyTeam.shootingPct * 100).toFixed(1)}% / SV ${(luckyTeam.savePct * 100).toFixed(1)}% — PDO ${(luckyTeam.pdo * 100).toFixed(1)}%, above avg, expect regression`
      );
    }
  }

  // ── Factor 2: Shot Share / Corsi Proxy (25% weight) ─────────────────────
  // Teams controlling shot attempts win more games regardless of current record.
  // Shot share < 45% or > 55% is significant.
  const shotShareDiff = home.shotSharePct - away.shotSharePct;
  const shotShareDelta = Math.abs(shotShareDiff);

  if (shotShareDelta > 0.02) {
    const dominantTeam = shotShareDiff > 0 ? home : away;
    const passiveTeam = shotShareDiff > 0 ? away : home;
    const favors = dominantTeam.abbrev === home.abbrev ? "home" : "away" as const;
    const strength =
      shotShareDelta > 0.06 ? "strong" : shotShareDelta > 0.035 ? "moderate" : "weak";

    signals.push({
      label: "Shot Dominance",
      favors,
      strength,
      description: `${dominantTeam.abbrev} ${(dominantTeam.shotSharePct * 100).toFixed(1)}% shot share vs ${passiveTeam.abbrev} ${(passiveTeam.shotSharePct * 100).toFixed(1)}% — corsi-like edge.`,
    });

    if (strength !== "weak") {
      keyReasons.push(
        `${dominantTeam.abbrev} controls ${(dominantTeam.shotSharePct * 100).toFixed(1)}% of shots — underlying play dominance not fully reflected in standings`
      );
    }
  }

  // ── Factor 3: Special Teams (15% weight) ────────────────────────────────
  // PP goals per game is consistent and predictive. Significant differences matter.
  const ppDiff = home.ppGoalsPerGame - away.ppGoalsPerGame;
  const ppDelta = Math.abs(ppDiff);

  if (ppDelta > 0.12) {
    const betterPP = ppDiff > 0 ? home : away;
    const favors = betterPP.abbrev === home.abbrev ? "home" : "away" as const;
    const strength = ppDelta > 0.25 ? "strong" : ppDelta > 0.16 ? "moderate" : "weak";

    signals.push({
      label: "Special Teams",
      favors,
      strength,
      description: `${betterPP.abbrev} ${betterPP.ppGoalsPerGame.toFixed(2)} PP goals/game vs ${(betterPP.abbrev === home.abbrev ? away : home).abbrev} ${(betterPP.abbrev === home.abbrev ? away : home).ppGoalsPerGame.toFixed(2)}.`,
    });

    if (strength !== "weak") {
      keyReasons.push(
        `${betterPP.abbrev} power play averaging ${betterPP.ppGoalsPerGame.toFixed(2)} goals/game — consistent advantage`
      );
    }
  }

  // ── Factor 4: Recent Form Trend (15% weight) ────────────────────────────
  // Not just L10 record — is the team improving or declining vs their season baseline?
  const formTrendDiff = home.l10Trend - away.l10Trend;
  const formTrendDelta = Math.abs(formTrendDiff);

  if (formTrendDelta > 0.12) {
    const trendingTeam = formTrendDiff > 0 ? home : away;
    const fadingTeam = formTrendDiff > 0 ? away : home;
    const favors = trendingTeam.abbrev === home.abbrev ? "home" : "away" as const;
    const strength =
      formTrendDelta > 0.22 ? "strong" : formTrendDelta > 0.15 ? "moderate" : "weak";

    signals.push({
      label: "Form Trend",
      favors,
      strength,
      description: `${trendingTeam.abbrev} L10: ${Math.round(trendingTeam.l10WinPct * 10)}-${10 - Math.round(trendingTeam.l10WinPct * 10)} (trending ${trendingTeam.l10Trend > 0 ? "up" : "down"} vs season). ${fadingTeam.abbrev} L10: ${Math.round(fadingTeam.l10WinPct * 10)}-${10 - Math.round(fadingTeam.l10WinPct * 10)}.`,
    });

    if (strength !== "weak") {
      keyReasons.push(
        `${trendingTeam.abbrev} ${trendingTeam.l10Trend > 0 ? "heating up" : "fading"} — L10 win% ${(trendingTeam.l10WinPct * 100).toFixed(0)}% vs season ${(trendingTeam.pointPctg * 100).toFixed(0)}%`
      );
    }
  }

  // ── Factor 5: Public Bias Correction (10% weight) ────────────────────────
  // Fading public darlings at the right price is a structural long-term edge.
  const homePublicPenalty = home.isPublicDarling ? -0.015 : 0;
  const awayPublicPenalty = away.isPublicDarling ? -0.015 : 0;

  if (home.isPublicDarling || away.isPublicDarling) {
    const darling = home.isPublicDarling ? home : away;
    const opponent = home.isPublicDarling ? away : home;
    const favors = opponent.abbrev === home.abbrev ? "home" : "away" as const;

    signals.push({
      label: "Public Bias",
      favors,
      strength: "weak",
      description: `${darling.abbrev} is a public favorite — market historically inflated 1–3% above fair value. Fading has long-term +EV.`,
    });
  }

  // ── Composite Win Probability ─────────────────────────────────────────────
  // Base: multi-factor season quality
  const normalize = (gdPG: number) => Math.max(0.1, Math.min(0.9, gdPG / 4 + 0.5));

  const homeBase =
    home.pointPctg * 0.30 +
    home.regWinPct * 0.20 +
    normalize(home.gdPerGame) * 0.15 +
    home.l10WinPct * 0.15 +
    (home.ppGoalsPerGame / 0.8) * 0.10 + // normalize PP goals
    home.shotSharePct * 0.10;

  const awayBase =
    away.pointPctg * 0.30 +
    away.regWinPct * 0.20 +
    normalize(away.gdPerGame) * 0.15 +
    away.l10WinPct * 0.15 +
    (away.ppGoalsPerGame / 0.8) * 0.10 +
    away.shotSharePct * 0.10;

  // PDO adjustment — luck correction
  const homeAdjusted = homeBase + homePDOScore * 0.3 + homePublicPenalty + 0.08; // +8% home ice
  const awayAdjusted = awayBase + awayPDOScore * 0.3 + awayPublicPenalty;

  const total = Math.max(homeAdjusted + awayAdjusted, 0.01);
  const rawProb = homeAdjusted / total;
  const homeWinProb = isFinite(rawProb)
    ? Math.min(0.84, Math.max(0.16, rawProb))
    : 0.5;

  // ── Confidence Gating ────────────────────────────────────────────────────
  // Only declare a pick "strong" when at least 2 meaningful signals agree.
  const strongSignals = signals.filter(
    (s) => s.strength === "strong" || s.strength === "moderate"
  );
  const favorDirection =
    homeWinProb > 0.5 ? "home" : "away";
  const agreingSignals = strongSignals.filter((s) => s.favors === favorDirection);

  const confidence: PickAnalysis["confidence"] =
    agreingSignals.length >= 2
      ? "strong"
      : agreingSignals.length === 1
      ? "lean"
      : "low";

  return {
    homeWinProb,
    awayWinProb: 1 - homeWinProb,
    confidence,
    signals,
    keyReasons: keyReasons.slice(0, 3),
  };
}
