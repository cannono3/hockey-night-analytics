import Image from "next/image";
import Link from "next/link";
import { LastNightGame } from "@/lib/nhl";

function periodLabel(type: string) {
  if (type === "OT") return "OT";
  if (type === "SO") return "SO";
  return "Final";
}

function topScorers(game: LastNightGame) {
  const scorerMap: Record<string, { name: string; team: string; goals: number; assists: number; mugshot: string }> = {};

  for (const g of game.goals) {
    const key = `${g.firstName.default} ${g.lastName.default}`;
    if (!scorerMap[key]) {
      scorerMap[key] = { name: key, team: g.teamAbbrev, goals: 0, assists: 0, mugshot: g.mugshot };
    }
    scorerMap[key].goals += 1;

    for (const a of g.assists) {
      const aKey = a.name.default;
      if (!scorerMap[aKey]) {
        scorerMap[aKey] = { name: aKey, team: g.teamAbbrev, goals: 0, assists: 0, mugshot: "" };
      }
      scorerMap[aKey].assists += 1;
    }
  }

  return Object.values(scorerMap)
    .sort((a, b) => (b.goals * 2 + b.assists) - (a.goals * 2 + a.assists))
    .slice(0, 3);
}

export default function LastNight({ games }: { games: LastNightGame[] }) {
  if (games.length === 0) {
    return (
      <div className="stat-card text-center py-8 text-[var(--muted)] text-sm">
        No games played last night.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {games.map((game) => {
        const awayWon = game.awayTeam.score > game.homeTeam.score;
        const outcome = game.gameOutcome?.lastPeriodType ?? "REG";
        const isBosGame = game.awayTeam.abbrev === "BOS" || game.homeTeam.abbrev === "BOS";
        const scorers = topScorers(game);

        return (
          <div
            key={game.id}
            className={`stat-card flex flex-col gap-4 ${isBosGame ? "border-[var(--accent)] gold-glow" : ""}`}
          >
            {/* Score header */}
            <div className="flex items-center justify-between">
              {/* Away */}
              <div className={`flex flex-col items-center gap-1 flex-1 ${awayWon ? "" : "opacity-50"}`}>
                <Image src={game.awayTeam.logo} alt={game.awayTeam.abbrev} width={36} height={36} className="object-contain" />
                <span className="text-xs font-semibold text-[var(--text-dim)]">{game.awayTeam.abbrev}</span>
                <span className={`text-3xl font-bold ${awayWon ? "text-[var(--text)]" : "text-[var(--muted)]"}`}>
                  {game.awayTeam.score}
                </span>
              </div>

              {/* Middle */}
              <div className="flex flex-col items-center gap-0.5 px-2">
                <span className="text-xs font-semibold text-[var(--muted)]">{periodLabel(outcome)}</span>
                <span className="text-xs text-[var(--muted)]">
                  {game.awayTeam.sog}–{game.homeTeam.sog} SOG
                </span>
              </div>

              {/* Home */}
              <div className={`flex flex-col items-center gap-1 flex-1 ${!awayWon ? "" : "opacity-50"}`}>
                <Image src={game.homeTeam.logo} alt={game.homeTeam.abbrev} width={36} height={36} className="object-contain" />
                <span className="text-xs font-semibold text-[var(--text-dim)]">{game.homeTeam.abbrev}</span>
                <span className={`text-3xl font-bold ${!awayWon ? "text-[var(--text)]" : "text-[var(--muted)]"}`}>
                  {game.homeTeam.score}
                </span>
              </div>
            </div>

            {/* Top scorers */}
            {scorers.length > 0 && (
              <div className="border-t border-[var(--border)] pt-3 space-y-1.5">
                {scorers.map((s) => (
                  <div key={s.name} className="flex items-center gap-2">
                    {s.mugshot ? (
                      <Image src={s.mugshot} alt={s.name} width={20} height={20} className="rounded-full object-cover bg-[var(--bg-elevated)]" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-[var(--bg-elevated)]" />
                    )}
                    <span className="text-xs text-[var(--text-dim)] flex-1 truncate">{s.name}</span>
                    <span className="text-xs font-semibold text-[var(--accent)]">
                      {s.goals > 0 && `${s.goals}G`}{s.goals > 0 && s.assists > 0 && " "}{s.assists > 0 && `${s.assists}A`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {isBosGame && (
              <Link
                href="/team/BOS"
                className="text-xs text-center text-[var(--accent)] hover:underline"
              >
                View Bruins stats
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
