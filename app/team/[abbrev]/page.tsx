import { getTeamStats, getTeamSchedule, getStandings } from "@/lib/nhl";
import Image from "next/image";
import Link from "next/link";
import TeamCharts from "@/components/TeamCharts";

interface Props {
  params: Promise<{ abbrev: string }>;
}

export const revalidate = 60;

export default async function TeamPage({ params }: Props) {
  const { abbrev } = await params;
  const upper = abbrev.toUpperCase();

  const [stats, schedule, standings] = await Promise.all([
    getTeamStats(upper),
    getTeamSchedule(upper),
    getStandings(),
  ]);

  const teamStanding = standings.find((t) => t.teamAbbrev.default === upper);
  const skaters = stats.skaters.sort((a, b) => b.points - a.points);
  const goalies = stats.goalies.sort((a, b) => b.wins - a.wins);

  // Build win/loss chart data from completed games
  const completedGames = schedule
    .filter((g) => g.gameState === "OFF" || g.gameState === "FINAL")
    .slice(-20);

  const gameResults = completedGames.map((g) => {
    const isHome = g.homeTeam.abbrev === upper;
    const teamScore = isHome ? (g.homeTeam.score ?? 0) : (g.awayTeam.score ?? 0);
    const oppScore = isHome ? (g.awayTeam.score ?? 0) : (g.homeTeam.score ?? 0);
    const opponent = isHome ? g.awayTeam.abbrev : g.homeTeam.abbrev;
    const win = teamScore > oppScore;
    return {
      date: g.gameDate.slice(5),
      gf: teamScore,
      ga: oppScore,
      opponent,
      result: (win ? "W" : "L") as "W" | "L",
    };
  });

  return (
    <div className="space-y-8">
      {/* Team header */}
      <div className="flex items-center gap-5">
        {teamStanding && (
          <Image
            src={teamStanding.teamLogo}
            alt={upper}
            width={72}
            height={72}
            className="object-contain"
          />
        )}
        <div>
          <h1 className="text-3xl font-bold text-[var(--text)]">
            {teamStanding?.teamName.default ?? upper}
          </h1>
          <p className="text-[var(--muted)] text-sm mt-0.5">
            {teamStanding?.divisionName} Division &middot; {teamStanding?.wins}W–{teamStanding?.losses}L–{teamStanding?.otLosses}OT &middot; {teamStanding?.points} pts
          </p>
        </div>
      </div>

      {/* Charts */}
      <TeamCharts gameResults={gameResults} />

      {/* Skater stats */}
      <section>
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
          Skater Stats
        </h2>
        <div className="stat-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[var(--muted)] border-b border-[var(--border)]">
                <th className="text-left pb-2 font-medium">Player</th>
                <th className="text-left pb-2 font-medium">Pos</th>
                <th className="text-right pb-2 font-medium px-2">GP</th>
                <th className="text-right pb-2 font-medium px-2">G</th>
                <th className="text-right pb-2 font-medium px-2">A</th>
                <th className="text-right pb-2 font-medium px-2">PTS</th>
                <th className="text-right pb-2 font-medium px-2">+/-</th>
                <th className="text-right pb-2 font-medium px-2">PPG</th>
                <th className="text-right pb-2 font-medium px-2">SOG</th>
                <th className="text-right pb-2 font-medium px-2">S%</th>
              </tr>
            </thead>
            <tbody>
              {skaters.map((s) => {
                const pm = s.plusMinus;
                return (
                  <tr
                    key={s.playerId}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    <td className="py-2.5">
                      <Link href={`/player/${s.playerId}`} className="flex items-center gap-2 group">
                        <Image
                          src={s.headshot}
                          alt={`${s.firstName.default} ${s.lastName.default}`}
                          width={28}
                          height={28}
                          className="rounded-full object-cover bg-[var(--bg-elevated)]"
                        />
                        <span className="font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                          {s.firstName.default} {s.lastName.default}
                        </span>
                      </Link>
                    </td>
                    <td className="py-2.5 text-[var(--muted)]">{s.positionCode}</td>
                    <td className="py-2.5 text-right text-[var(--text-dim)] px-2">{s.gamesPlayed}</td>
                    <td className="py-2.5 text-right text-[var(--text)] font-medium px-2">{s.goals}</td>
                    <td className="py-2.5 text-right text-[var(--text-dim)] px-2">{s.assists}</td>
                    <td className="py-2.5 text-right font-bold text-[var(--accent)] px-2">{s.points}</td>
                    <td className={`py-2.5 text-right font-medium px-2 ${pm > 0 ? "text-[var(--success)]" : pm < 0 ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                      {pm > 0 ? `+${pm}` : pm}
                    </td>
                    <td className="py-2.5 text-right text-[var(--text-dim)] px-2">{s.powerPlayGoals}</td>
                    <td className="py-2.5 text-right text-[var(--text-dim)] px-2">{s.shots}</td>
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

      {/* Goalies */}
      <section>
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
          Goalies
        </h2>
        <div className="stat-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[var(--muted)] border-b border-[var(--border)]">
                <th className="text-left pb-2 font-medium">Goalie</th>
                <th className="text-right pb-2 font-medium px-2">GP</th>
                <th className="text-right pb-2 font-medium px-2">W</th>
                <th className="text-right pb-2 font-medium px-2">L</th>
                <th className="text-right pb-2 font-medium px-2">OT</th>
                <th className="text-right pb-2 font-medium px-2">GAA</th>
                <th className="text-right pb-2 font-medium px-2">SV%</th>
                <th className="text-right pb-2 font-medium px-2">SO</th>
              </tr>
            </thead>
            <tbody>
              {goalies.map((g) => (
                <tr key={g.playerId} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-elevated)] transition-colors">
                  <td className="py-2.5">
                    <Link href={`/player/${g.playerId}`} className="flex items-center gap-2 group">
                      <Image
                        src={g.headshot}
                        alt={`${g.firstName.default} ${g.lastName.default}`}
                        width={28}
                        height={28}
                        className="rounded-full object-cover bg-[var(--bg-elevated)]"
                      />
                      <span className="font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                        {g.firstName.default} {g.lastName.default}
                      </span>
                    </Link>
                  </td>
                  <td className="py-2.5 text-right text-[var(--text-dim)] px-2">{g.gamesPlayed}</td>
                  <td className="py-2.5 text-right text-[var(--text)] font-medium px-2">{g.wins}</td>
                  <td className="py-2.5 text-right text-[var(--text-dim)] px-2">{g.losses}</td>
                  <td className="py-2.5 text-right text-[var(--text-dim)] px-2">{g.otLosses}</td>
                  <td className="py-2.5 text-right text-[var(--text-dim)] px-2">{g.goalsAgainstAvg?.toFixed(2)}</td>
                  <td className="py-2.5 text-right font-bold text-[var(--accent)] px-2">
                    {g.savePctg ? `.${Math.round(g.savePctg * 1000)}` : "—"}
                  </td>
                  <td className="py-2.5 text-right text-[var(--text-dim)] px-2">{g.shutouts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
