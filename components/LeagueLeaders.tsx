"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LeagueLeader } from "@/lib/nhl";

interface Props {
  pointLeaders: LeagueLeader[];
  goalLeaders: LeagueLeader[];
  assistLeaders: LeagueLeader[];
}

const TABS = [
  { key: "points", label: "Points" },
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
];

export default function LeagueLeaders({ pointLeaders, goalLeaders, assistLeaders }: Props) {
  const [tab, setTab] = useState("points");

  const leaders = tab === "points" ? pointLeaders : tab === "goals" ? goalLeaders : assistLeaders;
  const max = leaders[0]?.value ?? 1;

  return (
    <div className="stat-card">
      {/* Tab bar */}
      <div className="flex gap-1 mb-5 border-b border-[var(--border)] pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-[var(--accent)] text-black"
                : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {leaders.map((player, i) => (
          <Link
            key={player.id}
            href={`/player/${player.id}`}
            className="flex items-center gap-3 group"
          >
            <span className="w-5 text-xs text-[var(--muted)] text-right flex-shrink-0">{i + 1}</span>
            <Image
              src={player.headshot}
              alt={`${player.firstName.default} ${player.lastName.default}`}
              width={32}
              height={32}
              className="rounded-full object-cover bg-[var(--bg-elevated)] flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors truncate">
                  {player.firstName.default} {player.lastName.default}
                </span>
                <span className="text-sm font-bold text-[var(--accent)] ml-2 flex-shrink-0">
                  {player.value}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full transition-all"
                    style={{ width: `${(player.value / max) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-[var(--muted)] flex-shrink-0">{player.teamAbbrev}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
