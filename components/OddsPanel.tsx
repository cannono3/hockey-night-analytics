import Image from "next/image";
import { getNHLOdds } from "@/lib/odds";
import { removeVig, calcEdge, quarterKelly, americanToDecimal } from "@/lib/betting";
import { StandingTeam, TodayGame } from "@/lib/nhl";

function fmtOdds(price: number) {
  return price > 0 ? `+${price}` : `${price}`;
}

function fmtPoint(point: number) {
  return point > 0 ? `+${point}` : `${point}`;
}

function computeWinProbFraction(game: TodayGame, standings: StandingTeam[]): number | null {
  const homeAbbrev = game.homeTeam.abbrev;
  const awayAbbrev = game.awayTeam.abbrev;
  const home = standings.find((t) => t.teamAbbrev.default === homeAbbrev);
  const away = standings.find((t) => t.teamAbbrev.default === awayAbbrev);
  if (!home || !away) return null;

  // Multi-factor model:
  // 40% season point%  — overall quality
  // 20% L10 form       — recent momentum
  // 20% goal diff/game — shot quality proxy
  // 10% regulation wins% — wins that didn't need OT
  // 10% home ice
  const homeGD = home.gamesPlayed > 0 ? home.goalDifferential / home.gamesPlayed : 0;
  const awayGD = away.gamesPlayed > 0 ? away.goalDifferential / away.gamesPlayed : 0;
  const gdScale = 5; // normalize goal diff to ~0–1 range

  const homeRating =
    home.pointPctg * 0.40 +
    (home.l10Wins / 10) * 0.20 +
    ((homeGD / gdScale + 1) / 2) * 0.20 +
    (home.gamesPlayed > 0 ? home.regulationWins / home.gamesPlayed : 0) * 0.10 +
    0.10; // home ice

  const awayRating =
    away.pointPctg * 0.40 +
    (away.l10Wins / 10) * 0.20 +
    ((awayGD / gdScale + 1) / 2) * 0.20 +
    (away.gamesPlayed > 0 ? away.regulationWins / away.gamesPlayed : 0) * 0.10;

  const baseProb = homeRating / (homeRating + awayRating);

  const isLive = game.gameState === "LIVE" || game.gameState === "CRIT";
  if (!isLive) return baseProb;

  // Live: blend standings model with live score model
  const homeGoals = game.homeTeam.score ?? 0;
  const awayGoals = game.awayTeam.score ?? 0;
  const scoreDiff = homeGoals - awayGoals;

  const period = game.periodDescriptor?.number ?? 1;
  const timeStr = game.clock?.timeRemaining ?? "20:00";
  const inInt = game.clock?.inIntermission ?? false;

  if (period >= 4) {
    if (scoreDiff > 0) return 0.93;
    if (scoreDiff < 0) return 0.07;
    return baseProb;
  }

  const [m, s] = timeStr.split(":").map(Number);
  const periodLeft = inInt ? 20 : m + (s || 0) / 60;
  const minsLeft = (3 - period) * 20 + periodLeft;

  const pctPlayed = Math.max(0, Math.min(1, (60 - minsLeft) / 60));
  const scoreWeight = pctPlayed * 0.85;
  const goalValue = 0.15 + pctPlayed * 0.22;
  const scoreProb = Math.min(0.97, Math.max(0.03, 0.5 + scoreDiff * goalValue));

  return baseProb * (1 - scoreWeight) + scoreProb * scoreWeight;
}

interface EdgeResult {
  homeEdge: number;       // model prob − market implied prob
  awayEdge: number;
  homeKelly: number;      // quarter-kelly % of bankroll
  awayKelly: number;
  homeImplied: number;    // no-vig market probability
  awayImplied: number;
}

function calcBettingEdge(
  homeModelFrac: number,
  moneyline: { home: number; away: number }
): EdgeResult {
  const { home: homeImplied, away: awayImplied } = removeVig(
    moneyline.home,
    moneyline.away
  );
  const awayModelFrac = 1 - homeModelFrac;

  const homeEdge = calcEdge(homeModelFrac, homeImplied);
  const awayEdge = calcEdge(awayModelFrac, awayImplied);

  const homeKelly = quarterKelly(homeModelFrac, americanToDecimal(moneyline.home));
  const awayKelly = quarterKelly(awayModelFrac, americanToDecimal(moneyline.away));

  return {
    homeEdge,
    awayEdge,
    homeKelly,
    awayKelly,
    homeImplied,
    awayImplied,
  };
}

function EdgeBadge({ edge, kelly, label }: { edge: number; kelly: number; label: string }) {
  const pct = (edge * 100).toFixed(1);
  const isPos = edge > 0.01;
  const isNeg = edge < -0.01;

  return (
    <div
      className={`rounded-lg px-3 py-2 text-center ${
        isPos
          ? "bg-[var(--success)]/10 border border-[var(--success)]/30"
          : isNeg
          ? "bg-[var(--danger)]/10 border border-[var(--border)]"
          : "bg-[var(--bg-elevated)] border border-[var(--border)]"
      }`}
    >
      <p className="text-[10px] text-[var(--muted)] font-medium mb-0.5">{label}</p>
      <p
        className={`text-sm font-bold ${
          isPos ? "text-[var(--success)]" : isNeg ? "text-[var(--danger)]" : "text-[var(--muted)]"
        }`}
      >
        {isPos ? "+" : ""}{pct}% edge
      </p>
      {isPos && kelly > 0 && (
        <p className="text-[10px] text-[var(--muted)] mt-0.5">
          bet {kelly.toFixed(1)}% bankroll
        </p>
      )}
    </div>
  );
}

interface Props {
  todayGames: TodayGame[];
  standings: StandingTeam[];
}

export default async function OddsPanel({ todayGames, standings }: Props) {
  const oddsGames = await getNHLOdds();

  const relevant = todayGames.filter(
    (g) => g.gameState !== "OFF" && g.gameState !== "FINAL"
  );
  if (relevant.length === 0) return null;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
          Odds &amp; Predictions
        </h2>
        <span className="text-[10px] text-[var(--muted)]">
          Edge = model prob − market no-vig implied prob · quarter-Kelly sizing · not financial advice
        </span>
      </div>
      <div className="space-y-3">
        {relevant.map((game) => {
          const awayAbbrev = game.awayTeam.abbrev;
          const homeAbbrev = game.homeTeam.abbrev;

          const oddsMatch = oddsGames.find(
            (o) =>
              (o.homeTeam === homeAbbrev && o.awayTeam === awayAbbrev) ||
              (o.homeTeam === awayAbbrev && o.awayTeam === homeAbbrev)
          );
          const oddsFlipped =
            oddsMatch?.homeTeam === awayAbbrev && oddsMatch?.awayTeam === homeAbbrev;
          const odds = oddsMatch
            ? {
                ...oddsMatch,
                moneyline: oddsMatch.moneyline
                  ? oddsFlipped
                    ? { home: oddsMatch.moneyline.away, away: oddsMatch.moneyline.home }
                    : oddsMatch.moneyline
                  : undefined,
                spread: oddsMatch.spread
                  ? oddsFlipped
                    ? {
                        homePoint: -oddsMatch.spread.homePoint,
                        homePrice: oddsMatch.spread.awayPrice,
                        awayPrice: oddsMatch.spread.homePrice,
                      }
                    : oddsMatch.spread
                  : undefined,
              }
            : undefined;

          const isLive = game.gameState === "LIVE" || game.gameState === "CRIT";
          const homeModelFrac = computeWinProbFraction(game, standings);
          const homeWinPct = homeModelFrac !== null ? Math.round(homeModelFrac * 100) : null;
          const awayWinPct = homeWinPct !== null ? 100 - homeWinPct : null;

          const edge =
            homeModelFrac !== null && odds?.moneyline
              ? calcBettingEdge(homeModelFrac, odds.moneyline)
              : null;

          const time = new Date(game.startTimeUTC).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          });

          return (
            <div key={game.id} className="stat-card">
              {/* Teams + time */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Image
                      src={game.awayTeam.logo}
                      alt={awayAbbrev}
                      width={28}
                      height={28}
                      className="object-contain"
                    />
                    <span className="font-bold text-[var(--text)] text-sm">{awayAbbrev}</span>
                  </div>
                  <span className="text-xs text-[var(--muted)]">@</span>
                  <div className="flex items-center gap-2">
                    <Image
                      src={game.homeTeam.logo}
                      alt={homeAbbrev}
                      width={28}
                      height={28}
                      className="object-contain"
                    />
                    <span className="font-bold text-[var(--text)] text-sm">{homeAbbrev}</span>
                  </div>
                </div>
                <span className="text-xs text-[var(--muted)]">{time}</span>
              </div>

              {/* Win probability bar */}
              {homeWinPct !== null && awayWinPct !== null && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      {isLive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
                      )}
                      <span className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wide">
                        {isLive ? "Live Win Probability" : "Model Win Probability"}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--muted)]">
                      {isLive
                        ? `${game.awayTeam.score ?? 0}–${game.homeTeam.score ?? 0} · score + time weighted`
                        : "pt% · L10 · goal diff · reg wins · home ice"}
                    </span>
                  </div>
                  <div className="relative h-6 rounded-full overflow-hidden flex bg-[var(--bg-elevated)]">
                    <div
                      className="h-full flex items-center justify-center transition-all bg-slate-400/40"
                      style={{ width: `${awayWinPct}%` }}
                    >
                      {awayWinPct >= 20 && (
                        <span className="text-[10px] font-bold text-[var(--text)]">
                          {awayAbbrev} {awayWinPct}%
                        </span>
                      )}
                    </div>
                    <div
                      className="h-full flex items-center justify-center transition-all"
                      style={{
                        width: `${homeWinPct}%`,
                        background: "color-mix(in srgb, var(--accent) 60%, transparent)",
                      }}
                    >
                      {homeWinPct >= 20 && (
                        <span className="text-[10px] font-bold text-[var(--text)]">
                          {homeAbbrev} {homeWinPct}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] text-[var(--muted)]">{awayAbbrev} (away)</span>
                    <span className="text-[10px] text-[var(--muted)]">{homeAbbrev} (home)</span>
                  </div>
                </div>
              )}

              {/* Value edge */}
              {edge && !isLive && (
                <div className="mb-4">
                  <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">
                    Betting Edge (model vs market)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <EdgeBadge
                      edge={edge.awayEdge}
                      kelly={edge.awayKelly}
                      label={`${awayAbbrev} ML (mkt ${Math.round(edge.awayImplied * 100)}%)`}
                    />
                    <EdgeBadge
                      edge={edge.homeEdge}
                      kelly={edge.homeKelly}
                      label={`${homeAbbrev} ML (mkt ${Math.round(edge.homeImplied * 100)}%)`}
                    />
                  </div>
                </div>
              )}

              {/* Odds grid */}
              {odds ? (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[var(--bg-elevated)] rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-2 text-center">
                      Moneyline
                    </p>
                    {odds.moneyline ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[var(--muted)]">{awayAbbrev}</span>
                          <span className={`text-xs font-bold ${odds.moneyline.away > 0 ? "text-[var(--success)]" : "text-[var(--text)]"}`}>
                            {fmtOdds(odds.moneyline.away)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[var(--muted)]">{homeAbbrev}</span>
                          <span className={`text-xs font-bold ${odds.moneyline.home > 0 ? "text-[var(--success)]" : "text-[var(--text)]"}`}>
                            {fmtOdds(odds.moneyline.home)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-[var(--muted)] text-center">—</p>
                    )}
                  </div>

                  <div className="bg-[var(--bg-elevated)] rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-2 text-center">
                      Puck Line
                    </p>
                    {odds.spread ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[var(--muted)]">
                            {awayAbbrev} {fmtPoint(-odds.spread.homePoint)}
                          </span>
                          <span className="text-xs font-bold text-[var(--text)]">
                            {fmtOdds(odds.spread.awayPrice)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[var(--muted)]">
                            {homeAbbrev} {fmtPoint(odds.spread.homePoint)}
                          </span>
                          <span className="text-xs font-bold text-[var(--text)]">
                            {fmtOdds(odds.spread.homePrice)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-[var(--muted)] text-center">—</p>
                    )}
                  </div>

                  <div className="bg-[var(--bg-elevated)] rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-2 text-center">
                      Total
                    </p>
                    {odds.total ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[var(--muted)]">O {odds.total.point}</span>
                          <span className="text-xs font-bold text-[var(--text)]">
                            {fmtOdds(odds.total.overPrice)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[var(--muted)]">U {odds.total.point}</span>
                          <span className="text-xs font-bold text-[var(--text)]">
                            {fmtOdds(odds.total.underPrice)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-[var(--muted)] text-center">—</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--muted)] text-center py-1">
                  Odds not yet available
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
