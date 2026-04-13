import { getPlayerCareer } from "@/lib/nhl";
import Image from "next/image";
import PlayerCharts from "@/components/PlayerCharts";

interface Props {
  params: Promise<{ id: string }>;
}

export const revalidate = 3600;

export default async function PlayerPage({ params }: Props) {
  const { id } = await params;
  const player = await getPlayerCareer(Number(id));

  const nhlSeasons = (player.seasonTotals ?? [])
    .filter((s) => s.leagueAbbrev === "NHL" && s.gameTypeId === 2)
    .sort((a, b) => a.season - b.season);

  const current = player.featuredStats?.regularSeason?.subSeason;
  const career = player.featuredStats?.regularSeason?.career;

  function formatSeason(s: number) {
    const y = String(s).slice(0, 4);
    return `${y}-${String(Number(y) + 1).slice(2)}`;
  }

  return (
    <div className="space-y-8">
      {/* Player header */}
      <div className="flex items-center gap-5">
        <Image
          src={player.headshot}
          alt={`${player.firstName.default} ${player.lastName.default}`}
          width={80}
          height={80}
          className="rounded-full object-cover bg-[var(--bg-elevated)] border-2 border-[var(--border)]"
        />
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[var(--accent)] font-bold text-lg">#{player.sweaterNumber}</span>
            <span className="text-xs bg-[var(--bg-elevated)] text-[var(--muted)] px-2 py-0.5 rounded-full">
              {player.position}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-[var(--text)]">
            {player.firstName.default} {player.lastName.default}
          </h1>
          <p className="text-[var(--muted)] text-sm mt-0.5">
            {player.teamAbbrev} &middot; {player.birthCity?.default}, {player.birthCountry} &middot; {player.heightInInches ? `${Math.floor(player.heightInInches / 12)}'${player.heightInInches % 12}"` : "—"} / {player.weightInPounds} lbs
          </p>
        </div>
      </div>

      {/* This season + career summary */}
      {current && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Goals", season: current.goals, career: career?.goals },
            { label: "Assists", season: current.assists, career: career?.assists },
            { label: "Points", season: current.points, career: career?.points },
            { label: "+/-", season: current.plusMinus, career: career?.plusMinus },
          ].map(({ label, season, career: c }) => (
            <div key={label} className="stat-card">
              <p className="text-xs text-[var(--muted)] mb-1">{label}</p>
              <p className="text-3xl font-bold text-[var(--accent)]">{season ?? "—"}</p>
              <p className="text-xs text-[var(--muted)] mt-1">Career: {c ?? "—"}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      {nhlSeasons.length > 0 && (
        <PlayerCharts seasons={nhlSeasons} formatSeason={formatSeason} />
      )}

      {/* Season-by-season table */}
      <section>
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
          Career Stats
        </h2>
        <div className="stat-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[var(--muted)] border-b border-[var(--border)]">
                <th className="text-left pb-2 font-medium">Season</th>
                <th className="text-left pb-2 font-medium">Team</th>
                <th className="text-right pb-2 font-medium px-2">GP</th>
                <th className="text-right pb-2 font-medium px-2">G</th>
                <th className="text-right pb-2 font-medium px-2">A</th>
                <th className="text-right pb-2 font-medium px-2">PTS</th>
                <th className="text-right pb-2 font-medium px-2">+/-</th>
                <th className="text-right pb-2 font-medium px-2">PIM</th>
                <th className="text-right pb-2 font-medium px-2">PPG</th>
                <th className="text-right pb-2 font-medium px-2">S%</th>
              </tr>
            </thead>
            <tbody>
              {nhlSeasons.map((s, i) => {
                const isLatest = i === nhlSeasons.length - 1;
                return (
                  <tr
                    key={`${s.season}-${i}`}
                    className={`border-b border-[var(--border)] last:border-0 transition-colors ${
                      isLatest ? "bg-[var(--accent)]/5" : "hover:bg-[var(--bg-elevated)]"
                    }`}
                  >
                    <td className={`py-2.5 font-medium ${isLatest ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>
                      {formatSeason(s.season)}
                    </td>
                    <td className="py-2.5 text-[var(--text-dim)]">{s.teamName.default}</td>
                    <td className="py-2.5 text-right text-[var(--text-dim)] px-2">{s.gamesPlayed}</td>
                    <td className="py-2.5 text-right text-[var(--text)] font-medium px-2">{s.goals}</td>
                    <td className="py-2.5 text-right text-[var(--text-dim)] px-2">{s.assists}</td>
                    <td className="py-2.5 text-right font-bold text-[var(--accent)] px-2">{s.points}</td>
                    <td className={`py-2.5 text-right font-medium px-2 ${(s.plusMinus ?? 0) > 0 ? "text-[var(--success)]" : (s.plusMinus ?? 0) < 0 ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                      {(s.plusMinus ?? 0) > 0 ? `+${s.plusMinus}` : s.plusMinus ?? "—"}
                    </td>
                    <td className="py-2.5 text-right text-[var(--text-dim)] px-2">{s.pim ?? "—"}</td>
                    <td className="py-2.5 text-right text-[var(--text-dim)] px-2">{s.powerPlayGoals ?? "—"}</td>
                    <td className="py-2.5 text-right text-[var(--text-dim)] px-2">
                      {s.shootingPctg ? `${(s.shootingPctg * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
