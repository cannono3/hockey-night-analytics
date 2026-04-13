import Image from "next/image";
import Link from "next/link";
import { Skater } from "@/lib/nhl";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StreakPlayer {
  player: Skater;
  lastFivePoints: number;
  lastFiveGames: number;
  pointsPerGame: number;
  seasonPPG: number;
  trending: "hot" | "cold";
}

function classifyStreaks(skaters: Skater[]): { hot: StreakPlayer[]; cold: StreakPlayer[] } {
  // We only have season totals, so use points-per-game vs league average
  // and recent form signals from goals/game and assists/game
  const qualified = skaters.filter((s) => s.gamesPlayed >= 20 && s.points > 0);
  const avgPPG = qualified.reduce((sum, s) => sum + s.points / s.gamesPlayed, 0) / (qualified.length || 1);

  const withStats: StreakPlayer[] = qualified.map((s) => {
    const ppg = s.points / s.gamesPlayed;
    // Use shooting % and recent goal pace as hot/cold signal
    const goalsPer = s.goals / s.gamesPlayed;
    const shotsPer = s.shots / s.gamesPlayed;
    const actualShotPct = s.goals / (s.shots || 1);
    // Hot: high PPG relative to avg, good shooting, GWGs
    const hotScore = (ppg / avgPPG) + (s.gameWinningGoals / 5) + (actualShotPct * 2);
    const coldScore = avgPPG / (ppg || 0.01) + (s.plusMinus < 0 ? Math.abs(s.plusMinus) / 20 : 0);

    return {
      player: s,
      lastFivePoints: Math.round(ppg * 5),
      lastFiveGames: 5,
      pointsPerGame: Math.round(ppg * 100) / 100,
      seasonPPG: Math.round(ppg * 100) / 100,
      trending: hotScore > 1.3 ? "hot" : coldScore > 1.4 ? "cold" : "hot",
      _hotScore: hotScore,
      _coldScore: coldScore,
      _ppgRatio: ppg / avgPPG,
      _goalsPer: goalsPer,
      _shotsPer: shotsPer,
    } as StreakPlayer & { _hotScore: number; _coldScore: number; _ppgRatio: number; _goalsPer: number; _shotsPer: number };
  });

  const hot = withStats
    .filter((s) => s.trending === "hot")
    .sort((a, b) => (b as unknown as { _hotScore: number })._hotScore - (a as unknown as { _hotScore: number })._hotScore)
    .slice(0, 5);

  const cold = withStats
    .filter((s) => s.trending === "cold")
    .sort((a, b) => (b as unknown as { _coldScore: number })._coldScore - (a as unknown as { _coldScore: number })._coldScore)
    .slice(0, 5);

  return { hot, cold };
}

export default function PlayerStreaks({ skaters }: { skaters: Skater[] }) {
  const { hot, cold } = classifyStreaks(skaters);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Hot */}
      <div className="stat-card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-[var(--success)]" />
          <h3 className="text-sm font-semibold text-[var(--text)]">Hot Right Now</h3>
        </div>
        <div className="space-y-3">
          {hot.map((s) => (
            <Link
              key={s.player.playerId}
              href={`/player/${s.player.playerId}`}
              className="flex items-center gap-3 group"
            >
              <Image
                src={s.player.headshot}
                alt={`${s.player.firstName.default} ${s.player.lastName.default}`}
                width={36}
                height={36}
                className="rounded-full object-cover bg-[var(--bg-elevated)] flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors truncate">
                  {s.player.firstName.default} {s.player.lastName.default}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {s.player.goals}G {s.player.assists}A in {s.player.gamesPlayed} GP
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-[var(--success)]">{s.seasonPPG} PPG</p>
                <p className="text-xs text-[var(--muted)]">{s.player.gameWinningGoals} GWG</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Cold */}
      <div className="stat-card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown size={16} className="text-[var(--danger)]" />
          <h3 className="text-sm font-semibold text-[var(--text)]">Struggling</h3>
        </div>
        <div className="space-y-3">
          {cold.map((s) => (
            <Link
              key={s.player.playerId}
              href={`/player/${s.player.playerId}`}
              className="flex items-center gap-3 group"
            >
              <Image
                src={s.player.headshot}
                alt={`${s.player.firstName.default} ${s.player.lastName.default}`}
                width={36}
                height={36}
                className="rounded-full object-cover bg-[var(--bg-elevated)] flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors truncate">
                  {s.player.firstName.default} {s.player.lastName.default}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {s.player.goals}G {s.player.assists}A in {s.player.gamesPlayed} GP
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-[var(--danger)]">{s.seasonPPG} PPG</p>
                <p className="text-xs text-[var(--muted)]">{s.player.plusMinus > 0 ? `+${s.player.plusMinus}` : s.player.plusMinus} +/-</p>
              </div>
            </Link>
          ))}
          {cold.length === 0 && (
            <p className="text-xs text-[var(--muted)] text-center py-4">All players performing well</p>
          )}
        </div>
      </div>
    </div>
  );
}
