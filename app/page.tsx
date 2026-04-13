import { getStandings, getLeagueLeaders, getTodayGames, getLastNightScores } from "@/lib/nhl";
import StandingsTable from "@/components/StandingsTable";
import LeagueLeaders from "@/components/LeagueLeaders";
import TodayGames from "@/components/TodayGames";
import LastNight from "@/components/LastNight";
import TeamStreaksExplorer from "@/components/TeamStreaksExplorer";
import OddsPanel from "@/components/OddsPanel";
import BestPicks from "@/components/BestPicks";
import PickRecord from "@/components/PickRecord";

export const revalidate = 60;

export default async function DashboardPage() {
  // Fetch in two groups — live data together, cached stats sequentially
  const [standings, todayGames, lastNight] = await Promise.all([
    getStandings(),
    getTodayGames(),
    getLastNightScores(),
  ]);
  const pointLeaders = await getLeagueLeaders("points", 10);
  const goalLeaders = await getLeagueLeaders("goals", 10);
  const assistLeaders = await getLeagueLeaders("assists", 10);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text)]">Dashboard</h1>
        <p className="text-[var(--muted)] mt-1 text-sm">Live NHL data updated every minute</p>
      </div>

      {todayGames.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
            Tonight&apos;s Games
          </h2>
          <TodayGames games={todayGames} />
        </section>
      )}

      <PickRecord />
      <BestPicks todayGames={todayGames} standings={standings} />
      <OddsPanel todayGames={todayGames} standings={standings} />

      <section>
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
          Last Night
        </h2>
        <LastNight games={lastNight} />
      </section>

      <section>
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
          Player Form by Team
        </h2>
        <TeamStreaksExplorer standings={standings} defaultTeam="BOS" />
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
          NHL Standings
        </h2>
        <StandingsTable standings={standings} highlightTeam="BOS" />
      </section>
    </div>
  );
}
