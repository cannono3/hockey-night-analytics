import { getStandings } from "@/lib/nhl";
import Image from "next/image";
import Link from "next/link";

export const revalidate = 3600;

export default async function TeamsPage() {
  const standings = await getStandings();

  // Group by conference then division
  const structure: Record<string, Record<string, typeof standings>> = {};
  for (const team of standings) {
    const conf = team.conferenceName;
    const div = team.divisionName;
    if (!structure[conf]) structure[conf] = {};
    if (!structure[conf][div]) structure[conf][div] = [];
    structure[conf][div].push(team);
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text)]">Teams</h1>
        <p className="text-[var(--muted)] mt-1 text-sm">Select a team to view stats, charts, and player data</p>
      </div>

      {Object.entries(structure).map(([conf, divisions]) => (
        <div key={conf}>
          <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-4">
            {conf} Conference
          </h2>
          <div className="space-y-6">
            {Object.entries(divisions).map(([div, teams]) => (
              <div key={div}>
                <h3 className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-3 pl-1">
                  {div} Division
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {teams
                    .sort((a, b) => a.divisionSequence - b.divisionSequence)
                    .map((team) => {
                      const abbrev = team.teamAbbrev.default;
                      const streak = `${team.streakCode}${team.streakCount}`;
                      const gpct = (team.pointPctg * 100).toFixed(1);
                      return (
                        <Link
                          key={abbrev}
                          href={`/team/${abbrev}`}
                          className="stat-card flex flex-col items-center gap-3 py-5 hover:border-[var(--accent)] transition-colors group"
                        >
                          <Image
                            src={team.teamLogo}
                            alt={abbrev}
                            width={52}
                            height={52}
                            className="object-contain"
                          />
                          <div className="text-center">
                            <p className="text-sm font-bold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                              {team.teamCommonName.default}
                            </p>
                            <p className="text-xs text-[var(--muted)] mt-0.5">
                              {team.wins}–{team.losses}–{team.otLosses} · {team.points} pts
                            </p>
                            <div className="flex items-center justify-center gap-2 mt-1">
                              <span className="text-[10px] text-[var(--muted)]">{gpct}%</span>
                              <span
                                className="text-[10px] font-semibold"
                                style={{
                                  color: streak.startsWith("W")
                                    ? "var(--success)"
                                    : streak.startsWith("L")
                                    ? "var(--danger)"
                                    : "var(--muted)",
                                }}
                              >
                                {streak}
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
