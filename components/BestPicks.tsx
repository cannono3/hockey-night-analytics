import Image from "next/image";
import { getNHLOdds } from "@/lib/odds";
import { removeVig, calcEdge, quarterKelly, americanToDecimal, expectedValue } from "@/lib/betting";
import { StandingTeam, TodayGame, getTeamStatsBulk } from "@/lib/nhl";
import { buildTeamMetrics, runModel, TeamMetrics } from "@/lib/model";
import PickRecorder from "./PickRecorder";

interface Pick {
  gameId: number;
  teamAbbrev: string;
  teamLogo: string;
  opponentAbbrev: string;
  side: "home" | "away";
  moneyline: number;
  modelProb: number;
  impliedProb: number;
  edge: number;
  kelly: number;
  ev: number;
  confidence: "strong" | "lean" | "low";
  keyReasons: string[];
  homeMetrics: TeamMetrics;
  awayMetrics: TeamMetrics;
}

interface Props {
  todayGames: TodayGame[];
  standings: StandingTeam[];
}

const CONFIDENCE_CONFIG = {
  strong: { label: "Strong Pick", color: "var(--success)", bg: "color-mix(in srgb, var(--success) 12%, transparent)" },
  lean:   { label: "Lean",        color: "var(--accent)",  bg: "color-mix(in srgb, var(--accent) 12%, transparent)" },
  low:    { label: "Low Conf.",   color: "var(--muted)",   bg: "color-mix(in srgb, var(--muted) 8%, transparent)" },
};

export default async function BestPicks({ todayGames, standings }: Props) {
  // Pre-game only — live games have stale odds so EV is meaningless
  const upcoming = todayGames.filter(
    (g) => g.gameState === "FUT" || g.gameState === "PRE"
  );

  const anyGamesToday = todayGames.length > 0;

  if (upcoming.length === 0) {
    if (!anyGamesToday) return null;
    // Games exist but all have started — picks no longer valid
    return (
      <section>
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
          Today&apos;s Best Picks
        </h2>
        <div className="stat-card text-center py-6">
          <p className="text-sm font-semibold text-[var(--text)] mb-1">All games are underway</p>
          <p className="text-xs text-[var(--muted)]">
            Pre-game picks are no longer valid once odds go live. Check back tomorrow.
          </p>
        </div>
      </section>
    );
  }

  // Fetch team stats for all teams in today's games in parallel
  const allAbbrevs = upcoming.flatMap((g) => [g.homeTeam.abbrev, g.awayTeam.abbrev]);
  const [teamStatsMap, oddsGames] = await Promise.all([
    getTeamStatsBulk(allAbbrevs),
    getNHLOdds(),
  ]);

  const picks: Pick[] = [];

  for (const game of upcoming) {
    const homeAbbrev = game.homeTeam.abbrev;
    const awayAbbrev = game.awayTeam.abbrev;

    // Match odds
    const oddsMatch = oddsGames.find(
      (o) =>
        (o.homeTeam === homeAbbrev && o.awayTeam === awayAbbrev) ||
        (o.homeTeam === awayAbbrev && o.awayTeam === homeAbbrev)
    );
    if (!oddsMatch?.moneyline) continue;

    const oddsFlipped =
      oddsMatch.homeTeam === awayAbbrev && oddsMatch.awayTeam === homeAbbrev;
    const moneyline = oddsFlipped
      ? { home: oddsMatch.moneyline.away, away: oddsMatch.moneyline.home }
      : oddsMatch.moneyline;

    // Build team metrics
    const homeStanding = standings.find((s) => s.teamAbbrev.default === homeAbbrev);
    const awayStanding = standings.find((s) => s.teamAbbrev.default === awayAbbrev);
    if (!homeStanding || !awayStanding) continue;

    const homeStats = teamStatsMap[homeAbbrev];
    const awayStats = teamStatsMap[awayAbbrev];
    if (!homeStats || !awayStats) continue;

    const homeMetrics = buildTeamMetrics(homeAbbrev, homeStanding, homeStats.skaters, homeStats.goalies);
    const awayMetrics = buildTeamMetrics(awayAbbrev, awayStanding, awayStats.skaters, awayStats.goalies);

    // Run model
    const analysis = runModel(homeMetrics, awayMetrics);

    // Market implied probabilities (no-vig)
    const { home: homeImplied, away: awayImplied } = removeVig(moneyline.home, moneyline.away);

    // EV for each side
    const homeDecimal = americanToDecimal(moneyline.home);
    const awayDecimal = americanToDecimal(moneyline.away);
    const homeEV = isFinite(homeDecimal) ? expectedValue(analysis.homeWinProb, homeDecimal) : -1;
    const awayEV = isFinite(awayDecimal) ? expectedValue(analysis.awayWinProb, awayDecimal) : -1;

    // Pick the better-EV side
    const usHomeTeam = homeEV >= awayEV;
    const pickProb = usHomeTeam ? analysis.homeWinProb : analysis.awayWinProb;
    const pickImplied = usHomeTeam ? homeImplied : awayImplied;
    const pickML = usHomeTeam ? moneyline.home : moneyline.away;
    const pickEV = usHomeTeam ? homeEV : awayEV;
    const pickEdge = calcEdge(pickProb, pickImplied);
    const pickKelly = quarterKelly(pickProb, americanToDecimal(pickML));

    picks.push({
      gameId: game.id,
      teamAbbrev: usHomeTeam ? homeAbbrev : awayAbbrev,
      teamLogo: usHomeTeam ? game.homeTeam.logo : game.awayTeam.logo,
      opponentAbbrev: usHomeTeam ? awayAbbrev : homeAbbrev,
      side: usHomeTeam ? "home" : "away",
      moneyline: pickML,
      modelProb: pickProb,
      impliedProb: pickImplied,
      edge: pickEdge,
      kelly: pickKelly,
      ev: pickEV,
      confidence: analysis.confidence,
      keyReasons: analysis.keyReasons,
      homeMetrics,
      awayMetrics,
    });
  }

  // Sort: strong > lean > low, then by EV within each tier
  const tierOrder = { strong: 0, lean: 1, low: 2 };
  const top = picks
    .sort((a, b) =>
      tierOrder[a.confidence] !== tierOrder[b.confidence]
        ? tierOrder[a.confidence] - tierOrder[b.confidence]
        : b.ev - a.ev
    )
    .slice(0, 5);

  if (top.length === 0) return null;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
          Today&apos;s Best Picks
        </h2>
        <span className="text-[10px] text-[var(--muted)]">
          PDO · shot share · special teams · public bias · quarter-Kelly sizing
        </span>
      </div>

      <div className="space-y-3">
        {top.map((pick, i) => {
          const cfg = CONFIDENCE_CONFIG[pick.confidence];
          const homeM = pick.homeMetrics;
          const awayM = pick.awayMetrics;

          return (
            <div key={`${pick.gameId}-${pick.side}`} className="stat-card">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  {/* Rank + confidence */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <span className="text-xs font-bold text-[var(--muted)]">#{i + 1}</span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ color: cfg.color, background: cfg.bg }}
                    >
                      {cfg.label}
                    </span>
                  </div>

                  {/* Team + matchup */}
                  <Image
                    src={pick.teamLogo}
                    alt={pick.teamAbbrev}
                    width={32}
                    height={32}
                    className="object-contain flex-shrink-0"
                  />
                  <div>
                    <p className="text-sm font-bold text-[var(--text)]">
                      {pick.teamAbbrev} ML{" "}
                      <span className="font-semibold" style={{ color: pick.moneyline > 0 ? "var(--success)" : "var(--text)" }}>
                        {pick.moneyline > 0 ? `+${pick.moneyline}` : pick.moneyline}
                      </span>
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {pick.side === "home" ? "Home" : "Away"} vs {pick.opponentAbbrev}
                    </p>
                  </div>
                </div>

                {/* EV box */}
                <div
                  className="flex-shrink-0 rounded-xl px-3 py-2 text-center"
                  style={{ background: pick.ev > 0 ? cfg.bg : "color-mix(in srgb, var(--danger) 10%, transparent)" }}
                >
                  <p className="text-[10px] text-[var(--muted)]">per $100</p>
                  <p
                    className="text-base font-bold"
                    style={{ color: pick.ev > 0 ? cfg.color : "var(--danger)" }}
                  >
                    {isFinite(pick.ev) ? `${pick.ev > 0 ? "+" : ""}$${(pick.ev * 100).toFixed(2)}` : "—"}
                  </p>
                  {pick.kelly > 0 && pick.ev > 0 && (
                    <p className="text-[10px] text-[var(--muted)]">{pick.kelly.toFixed(1)}% bank</p>
                  )}
                </div>
              </div>

              {/* Probability bar */}
              <div className="mb-3">
                <div className="flex justify-between text-[10px] text-[var(--muted)] mb-1">
                  <span>Model {Math.round(pick.modelProb * 100)}%</span>
                  <span>Market (no-vig) {Math.round(pick.impliedProb * 100)}%</span>
                  <span style={{ color: pick.edge > 0 ? "var(--success)" : "var(--danger)" }}>
                    {pick.edge > 0 ? "+" : ""}{(pick.edge * 100).toFixed(1)}% edge
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(pick.modelProb * 100)}%`,
                      background: cfg.color,
                    }}
                  />
                </div>
                <div className="relative mt-0.5">
                  <div
                    className="absolute w-0.5 h-2 bg-[var(--muted)] rounded-full -top-1"
                    style={{ left: `${Math.round(pick.impliedProb * 100)}%` }}
                  />
                </div>
              </div>

              {/* Key model signals */}
              {pick.keyReasons.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {pick.keyReasons.map((reason, j) => (
                    <div key={j} className="flex items-start gap-2">
                      <span style={{ color: cfg.color }} className="text-xs mt-0.5 flex-shrink-0">▸</span>
                      <p className="text-xs text-[var(--text-dim)]">{reason}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* PDO + shot share snapshot */}
              <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[var(--border)]">
                {[homeM, awayM].map((m) => (
                  <div key={m.abbrev} className="text-xs space-y-0.5">
                    <p className="font-semibold text-[var(--text)]">{m.abbrev}</p>
                    <p className="text-[var(--muted)]">
                      PDO{" "}
                      <span
                        className="font-medium"
                        style={{
                          color:
                            m.pdoDeviation > 0.02
                              ? "var(--danger)"
                              : m.pdoDeviation < -0.02
                              ? "var(--success)"
                              : "var(--text)",
                        }}
                      >
                        {(m.pdo * 100).toFixed(1)}%
                      </span>
                      {m.pdoDeviation > 0.02 && " ↓ regression risk"}
                      {m.pdoDeviation < -0.02 && " ↑ due to improve"}
                    </p>
                    <p className="text-[var(--muted)]">
                      Shot share{" "}
                      <span className="font-medium text-[var(--text)]">
                        {(m.shotSharePct * 100).toFixed(1)}%
                      </span>
                    </p>
                    <p className="text-[var(--muted)]">
                      PP{" "}
                      <span className="font-medium text-[var(--text)]">
                        {m.ppGoalsPerGame.toFixed(2)}
                      </span>{" "}
                      G/gm
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-[var(--muted)] mt-3">
        Model uses PDO regression, shot share (Corsi proxy), special teams, form trend, and public betting bias.
        No model beats an efficient market consistently — treat Strong picks as higher-confidence, not guaranteed.
        Gamble responsibly.
      </p>

      {/* Silently record picks to localStorage so results can be tracked */}
      <PickRecorder
        picks={top.map((p) => ({
          gameId: p.gameId,
          pickedTeam: p.teamAbbrev,
          opponent: p.opponentAbbrev,
          side: p.side,
          moneyline: p.moneyline,
          ev: p.ev,
          confidence: p.confidence,
        }))}
        date={new Date().toLocaleDateString("en-CA")} // YYYY-MM-DD in local time
      />
    </section>
  );
}
