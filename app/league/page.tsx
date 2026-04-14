import { getStandings, getLeagueLeaders } from "@/lib/nhl";
import StandingsTable from "@/components/StandingsTable";
import LeagueLeaders from "@/components/LeagueLeaders";
import TeamStreaksExplorer from "@/components/TeamStreaksExplorer";

export const revalidate = 300;

export default async function LeaguePage() {
  const standings = await getStandings();
  const pointLeaders = await getLeagueLeaders("points", 10);
  const goalLeaders = await getLeagueLeaders("goals", 10);
  const assistLeaders = await getLeagueLeaders("assists", 10);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text)]">League</h1>
        <p className="text-[var(--muted)] mt-1 text-sm">
          Standings, leaders, and player form
        </p>
      </div>

      <section>
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
          NHL Standings
        </h2>
        <StandingsTable standings={standings} highlightTeam="BOS" />
      </section>

      <section>
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
          League Leaders
        </h2>
        <LeagueLeaders
          pointLeaders={pointLeaders}
          goalLeaders={goalLeaders}
          assistLeaders={assistLeaders}
        />
      </section>

      <section>
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
          Player Form by Team
        </h2>
        <TeamStreaksExplorer standings={standings} defaultTeam="BOS" />
      </section>
    </div>
  );
}
