import { getStandings, getTodayGames } from "@/lib/nhl";
import OddsPanel from "@/components/OddsPanel";
import BestPicks from "@/components/BestPicks";
import PickRecord from "@/components/PickRecord";

export const revalidate = 60;

export default async function BettingPage() {
  const [standings, todayGames] = await Promise.all([
    getStandings(),
    getTodayGames(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text)]">Betting</h1>
        <p className="text-[var(--muted)] mt-1 text-sm">
          Model picks, live odds, and your pick record
        </p>
      </div>

      <PickRecord />
      <BestPicks todayGames={todayGames} standings={standings} />
      <OddsPanel todayGames={todayGames} standings={standings} />
    </div>
  );
}
