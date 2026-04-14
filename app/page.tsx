import { getTodayGames, getLastNightScores } from "@/lib/nhl";
import TodayGames from "@/components/TodayGames";
import LastNight from "@/components/LastNight";

export const revalidate = 60;

export default async function DashboardPage() {
  const [todayGames, lastNight] = await Promise.all([
    getTodayGames(),
    getLastNightScores(),
  ]);

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

      <section>
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
          Last Night
        </h2>
        <LastNight games={lastNight} />
      </section>
    </div>
  );
}
