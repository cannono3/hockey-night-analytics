"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { TrendingUp, TrendingDown, Loader2, ChevronDown } from "lucide-react";
import { StandingTeam } from "@/lib/nhl";

interface Skater {
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
  shots: number;
  shootingPctg: number;
  gameWinningGoals: number;
}

interface StreakPlayer {
  player: Skater;
  ppg: number;
  trending: "hot" | "cold";
  hotScore: number;
  coldScore: number;
}

function classifyStreaks(skaters: Skater[]) {
  const qualified = skaters.filter((s) => s.gamesPlayed >= 15 && s.points > 0);
  const avgPPG =
    qualified.reduce((sum, s) => sum + s.points / s.gamesPlayed, 0) /
    (qualified.length || 1);

  const withScores: StreakPlayer[] = qualified.map((s) => {
    const ppg = s.points / s.gamesPlayed;
    const actualShotPct = s.goals / (s.shots || 1);
    const hotScore =
      ppg / avgPPG + (s.gameWinningGoals / 5) + actualShotPct * 2;
    const coldScore =
      avgPPG / (ppg || 0.01) +
      (s.plusMinus < 0 ? Math.abs(s.plusMinus) / 20 : 0);
    return {
      player: s,
      ppg: Math.round(ppg * 100) / 100,
      trending: hotScore > 1.3 ? "hot" : coldScore > 1.4 ? "cold" : "hot",
      hotScore,
      coldScore,
    };
  });

  const hot = withScores
    .filter((s) => s.trending === "hot")
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, 6);

  const cold = withScores
    .filter((s) => s.trending === "cold")
    .sort((a, b) => b.coldScore - a.coldScore)
    .slice(0, 6);

  return { hot, cold };
}

interface Props {
  standings: StandingTeam[];
  defaultTeam?: string;
}

export default function TeamStreaksExplorer({ standings, defaultTeam = "BOS" }: Props) {
  const [selectedAbbrev, setSelectedAbbrev] = useState(defaultTeam);
  const [skaters, setSkaters] = useState<Skater[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const selectedTeam = standings.find(
    (t) => t.teamAbbrev.default === selectedAbbrev
  );

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const res = await fetch(`/api/team-stats/${selectedAbbrev}`);
        const data = await res.json();
        setSkaters(data.skaters ?? []);
      } catch {
        setSkaters([]);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [selectedAbbrev]);

  const { hot, cold } = classifyStreaks(skaters);

  // Group teams by division for the dropdown
  const divisions: Record<string, StandingTeam[]> = {};
  for (const t of standings) {
    const div = t.divisionName;
    if (!divisions[div]) divisions[div] = [];
    divisions[div].push(t);
  }

  return (
    <div className="space-y-4">
      {/* Team selector */}
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3 hover:border-[var(--accent)] transition-colors w-full sm:w-auto"
        >
          {selectedTeam && (
            <Image
              src={selectedTeam.teamLogo}
              alt={selectedAbbrev}
              width={24}
              height={24}
              className="object-contain"
            />
          )}
          <span className="font-semibold text-[var(--text)] text-sm">
            {selectedTeam?.teamName.default ?? selectedAbbrev}
          </span>
          <ChevronDown
            size={14}
            className={`text-[var(--muted)] ml-auto transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 z-40 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl overflow-auto max-h-80 w-72">
            {Object.entries(divisions).map(([div, teams]) => (
              <div key={div}>
                <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest px-3 pt-3 pb-1">
                  {div}
                </p>
                {teams.map((t) => {
                  const abbrev = t.teamAbbrev.default;
                  const active = abbrev === selectedAbbrev;
                  return (
                    <button
                      key={abbrev}
                      onClick={() => { setSelectedAbbrev(abbrev); setOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "text-[var(--text-dim)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text)]"
                      }`}
                    >
                      <Image
                        src={t.teamLogo}
                        alt={abbrev}
                        width={20}
                        height={20}
                        className="object-contain"
                      />
                      <span className="font-medium">{t.teamCommonName.default}</span>
                      <span className="ml-auto text-[10px] text-[var(--muted)]">{abbrev}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-[var(--muted)]">
          <Loader2 size={16} className="animate-spin text-[var(--accent)]" />
          <span className="text-sm">Loading {selectedAbbrev} stats...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Hot */}
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-[var(--success)]" />
              <h3 className="text-sm font-semibold text-[var(--text)]">Hot Right Now</h3>
            </div>
            <div className="space-y-3">
              {hot.length === 0 ? (
                <p className="text-xs text-[var(--muted)] text-center py-4">No data available</p>
              ) : (
                hot.map((s) => (
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
                        {s.player.goals}G {s.player.assists}A · {s.player.gamesPlayed} GP
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-[var(--success)]">{s.ppg} PPG</p>
                      <p className="text-xs text-[var(--muted)]">{s.player.gameWinningGoals} GWG</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Cold */}
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown size={16} className="text-[var(--danger)]" />
              <h3 className="text-sm font-semibold text-[var(--text)]">Struggling</h3>
            </div>
            <div className="space-y-3">
              {cold.length === 0 ? (
                <p className="text-xs text-[var(--muted)] text-center py-4">All players performing well</p>
              ) : (
                cold.map((s) => (
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
                        {s.player.goals}G {s.player.assists}A · {s.player.gamesPlayed} GP
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-[var(--danger)]">{s.ppg} PPG</p>
                      <p className="text-xs text-[var(--muted)]">
                        {s.player.plusMinus > 0 ? `+${s.player.plusMinus}` : s.player.plusMinus} +/-
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
