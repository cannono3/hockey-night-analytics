"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { StandingTeam } from "@/lib/nhl";

interface Props {
  standings: StandingTeam[];
  highlightTeam?: string;
}

const CONFERENCES = ["Eastern", "Western"];
const DIVISIONS: Record<string, string[]> = {
  Eastern: ["Atlantic", "Metropolitan"],
  Western: ["Central", "Pacific"],
};

export default function StandingsTable({ standings, highlightTeam }: Props) {
  const [conf, setConf] = useState("Eastern");

  const divisions = DIVISIONS[conf];

  return (
    <div className="stat-card">
      {/* Conference tabs */}
      <div className="flex gap-1 mb-5 border-b border-[var(--border)] pb-3">
        {CONFERENCES.map((c) => (
          <button
            key={c}
            onClick={() => setConf(c)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              conf === c
                ? "bg-[var(--accent)] text-black"
                : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {divisions.map((div) => {
        const teams = standings
          .filter((t) => t.divisionName === div)
          .sort((a, b) => a.divisionSequence - b.divisionSequence);

        return (
          <div key={div} className="mb-6 last:mb-0">
            <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
              {div}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-[var(--muted)] border-b border-[var(--border)]">
                    <th className="text-left pb-2 font-medium w-8">#</th>
                    <th className="text-left pb-2 font-medium">Team</th>
                    <th className="text-right pb-2 font-medium px-2">GP</th>
                    <th className="text-right pb-2 font-medium px-2">W</th>
                    <th className="text-right pb-2 font-medium px-2">L</th>
                    <th className="text-right pb-2 font-medium px-2">OT</th>
                    <th className="text-right pb-2 font-medium px-2">PTS</th>
                    <th className="text-right pb-2 font-medium px-2">GF</th>
                    <th className="text-right pb-2 font-medium px-2">GA</th>
                    <th className="text-right pb-2 font-medium px-2">DIFF</th>
                    <th className="text-right pb-2 font-medium px-2">L10</th>
                    <th className="text-right pb-2 font-medium px-2">STK</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team, i) => {
                    const abbrev = team.teamAbbrev.default;
                    const isHighlight = abbrev === highlightTeam;
                    const streak = `${team.streakCode}${team.streakCount}`;
                    const diff = team.goalDifferential;
                    return (
                      <tr
                        key={abbrev}
                        className={`border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--bg-elevated)] ${
                          isHighlight ? "bg-[var(--accent)]/8" : ""
                        }`}
                      >
                        <td className="py-2.5 text-[var(--muted)] text-xs">{i + 1}</td>
                        <td className="py-2.5">
                          <Link
                            href={`/team/${abbrev}`}
                            className="flex items-center gap-2 group"
                          >
                            <Image
                              src={team.teamLogo}
                              alt={abbrev}
                              width={22}
                              height={22}
                              className="object-contain"
                            />
                            <span className={`font-semibold group-hover:text-[var(--accent)] transition-colors ${isHighlight ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>
                              {team.teamCommonName.default}
                            </span>
                          </Link>
                        </td>
                        <td className="py-2.5 text-right text-[var(--text-dim)] px-2">{team.gamesPlayed}</td>
                        <td className="py-2.5 text-right text-[var(--text)] font-medium px-2">{team.wins}</td>
                        <td className="py-2.5 text-right text-[var(--text-dim)] px-2">{team.losses}</td>
                        <td className="py-2.5 text-right text-[var(--text-dim)] px-2">{team.otLosses}</td>
                        <td className="py-2.5 text-right font-bold text-[var(--accent)] px-2">{team.points}</td>
                        <td className="py-2.5 text-right text-[var(--text-dim)] px-2">{team.goalFor}</td>
                        <td className="py-2.5 text-right text-[var(--text-dim)] px-2">{team.goalAgainst}</td>
                        <td className={`py-2.5 text-right font-medium px-2 ${diff > 0 ? "text-[var(--success)]" : diff < 0 ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </td>
                        <td className="py-2.5 text-right text-[var(--text-dim)] px-2">
                          {team.l10Wins}-{team.l10Losses}-{team.l10OtLosses}
                        </td>
                        <td className={`py-2.5 text-right font-semibold px-2 ${team.streakCode === "W" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                          {streak}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
