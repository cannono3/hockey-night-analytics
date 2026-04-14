import { getStandings, getLeagueLeaders, getTeamStats } from "@/lib/nhl";
import Image from "next/image";
import Link from "next/link";
import { Trophy } from "lucide-react";

export const revalidate = 3600;

// ── Award definitions ─────────────────────────────────────────────────────────
// Each award has a set of weighted criteria pulled from available NHL API data.

interface AwardCandidate {
  playerId: number;
  name: string;
  headshot: string;
  teamAbbrev: string;
  teamLogo: string;
  score: number;        // normalized 0–100
  stats: { label: string; value: string }[];
  reasons: string[];
}

interface Award {
  name: string;
  description: string;
  candidates: AwardCandidate[];
}

export default async function AwardsPage() {
  // Sequential to avoid 429 — league leaders are cached 1hr so this is fast after first load
  const standings = await getStandings();
  const pointLeaders = await getLeagueLeaders("points", 20);
  const goalLeaders = await getLeagueLeaders("goals", 20);
  const assistLeaders = await getLeagueLeaders("assists", 20);

  // Fetch skater stats for top teams only — sequential batches to avoid 429
  const topTeams = [...new Set(pointLeaders.slice(0, 10).map((p) => p.teamAbbrev))];
  const teamStatsMap: Record<string, Awaited<ReturnType<typeof getTeamStats>>> = {};
  for (const abbrev of topTeams) {
    try {
      teamStatsMap[abbrev] = await getTeamStats(abbrev);
      await new Promise((r) => setTimeout(r, 300));
    } catch { /* skip */ }
  }

  function getSkaterDetail(playerId: number, teamAbbrev: string) {
    return teamStatsMap[teamAbbrev]?.skaters?.find((s) => s.playerId === playerId);
  }

  // ── Hart Trophy (MVP) ─────────────────────────────────────────────────────
  // Most valuable player — combines points, goals, team success
  const hartCandidates: AwardCandidate[] = pointLeaders.slice(0, 10).map((p) => {
    const detail = getSkaterDetail(p.id, p.teamAbbrev);
    const teamStanding = standings.find((t) => t.teamAbbrev.default === p.teamAbbrev);
    const teamPts = teamStanding?.points ?? 0;
    const teamPctg = teamStanding?.pointPctg ?? 0;
    // Score: 50% pts (normalized), 30% team success, 20% goals
    const goalRank = goalLeaders.findIndex((g) => g.id === p.id);
    const score = (p.value / 140) * 50 + teamPctg * 30 + (goalRank >= 0 ? (1 - goalRank / 20) * 20 : 0);
    const reasons: string[] = [];
    if (teamPctg > 0.62) reasons.push(`Team is a top contender (${teamPts} pts)`);
    if (goalRank >= 0 && goalRank < 5) reasons.push(`Top-5 goal scorer`);
    if (p.value >= 90) reasons.push(`Elite point total (${p.value} pts)`);
    return {
      playerId: p.id,
      name: `${p.firstName.default} ${p.lastName.default}`,
      headshot: p.headshot,
      teamAbbrev: p.teamAbbrev,
      teamLogo: p.teamLogo,
      score: Math.min(100, score),
      stats: [
        { label: "Points", value: `${p.value}` },
        { label: "Team Pts", value: `${teamPts}` },
        { label: "Team Pt%", value: `${(teamPctg * 100).toFixed(1)}%` },
        ...(detail ? [{ label: "+/-", value: detail.plusMinus > 0 ? `+${detail.plusMinus}` : `${detail.plusMinus}` }] : []),
      ],
      reasons,
    };
  }).sort((a, b) => b.score - a.score).slice(0, 5);

  // ── Art Ross Trophy (points leader) ──────────────────────────────────────
  const artRossCandidates: AwardCandidate[] = pointLeaders.slice(0, 5).map((p, i) => ({
    playerId: p.id,
    name: `${p.firstName.default} ${p.lastName.default}`,
    headshot: p.headshot,
    teamAbbrev: p.teamAbbrev,
    teamLogo: p.teamLogo,
    score: Math.max(10, 100 - i * 15),
    stats: [{ label: "Points", value: `${p.value}` }],
    reasons: i === 0 ? ["Current points leader"] : [`${pointLeaders[0].value - p.value} pts behind leader`],
  }));

  // ── Rocket Richard Trophy (goals leader) ─────────────────────────────────
  const richardCandidates: AwardCandidate[] = goalLeaders.slice(0, 5).map((p, i) => ({
    playerId: p.id,
    name: `${p.firstName.default} ${p.lastName.default}`,
    headshot: p.headshot,
    teamAbbrev: p.teamAbbrev,
    teamLogo: p.teamLogo,
    score: Math.max(10, 100 - i * 15),
    stats: [{ label: "Goals", value: `${p.value}` }],
    reasons: i === 0 ? ["Current goals leader"] : [`${goalLeaders[0].value - p.value} goals behind leader`],
  }));

  // ── Norris Trophy (best defenseman) ──────────────────────────────────────
  // Filter point leaders to defensemen
  const allWithDetails = pointLeaders.map((p) => ({
    ...p,
    detail: getSkaterDetail(p.id, p.teamAbbrev),
  }));
  const defensemen = allWithDetails.filter((p) => p.detail?.positionCode === "D");

  const norrisCandidates: AwardCandidate[] = defensemen.slice(0, 5).map((p) => {
    const d = p.detail!;
    const score = (p.value / 80) * 60 + (d.plusMinus > 0 ? Math.min(d.plusMinus / 30, 1) * 25 : 0) + (d.powerPlayGoals / 15) * 15;
    return {
      playerId: p.id,
      name: `${p.firstName.default} ${p.lastName.default}`,
      headshot: p.headshot,
      teamAbbrev: p.teamAbbrev,
      teamLogo: p.teamLogo,
      score: Math.min(100, score),
      stats: [
        { label: "Points", value: `${p.value}` },
        { label: "+/-", value: d.plusMinus > 0 ? `+${d.plusMinus}` : `${d.plusMinus}` },
        { label: "PPG", value: `${d.powerPlayGoals}` },
        { label: "Shots", value: `${d.shots}` },
      ],
      reasons: [
        `${p.value} points as a defenseman`,
        ...(d.plusMinus > 15 ? [`Strong +/- of +${d.plusMinus}`] : []),
        ...(d.powerPlayGoals >= 8 ? [`${d.powerPlayGoals} PP goals`] : []),
      ],
    };
  }).sort((a, b) => b.score - a.score);

  // ── Lady Byng (gentlemanly play + skill) ─────────────────────────────────
  // High points, low PIMs, positive +/-
  const ladyByngCandidates: AwardCandidate[] = allWithDetails
    .filter((p) => p.detail && p.detail.penaltyMinutes <= 12 && p.value >= 50)
    .map((p) => {
      const d = p.detail!;
      const pimPenalty = d.penaltyMinutes / 2;
      const score = (p.value / 120) * 70 + (d.plusMinus > 0 ? 20 : 0) - pimPenalty;
      return {
        playerId: p.id,
        name: `${p.firstName.default} ${p.lastName.default}`,
        headshot: p.headshot,
        teamAbbrev: p.teamAbbrev,
        teamLogo: p.teamLogo,
        score: Math.max(0, Math.min(100, score)),
        stats: [
          { label: "Points", value: `${p.value}` },
          { label: "PIM", value: `${d.penaltyMinutes}` },
          { label: "+/-", value: d.plusMinus > 0 ? `+${d.plusMinus}` : `${d.plusMinus}` },
        ],
        reasons: [
          `Only ${d.penaltyMinutes} PIM with ${p.value} points`,
          ...(d.plusMinus > 0 ? [`Positive player at +${d.plusMinus}`] : []),
        ],
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Normalize each award's scores so they sum to 100%
  function normalize(candidates: AwardCandidate[]): AwardCandidate[] {
    const total = candidates.reduce((s, c) => s + c.score, 0);
    if (total === 0) return candidates;
    return candidates.map((c) => ({ ...c, score: Math.round((c.score / total) * 100) }));
  }

  const awards: Award[] = [
    { name: "Hart Trophy", description: "Most valuable player to his team", candidates: normalize(hartCandidates) },
    { name: "Art Ross Trophy", description: "Regular season scoring champion", candidates: normalize(artRossCandidates) },
    { name: "Rocket Richard Trophy", description: "Regular season goals leader", candidates: normalize(richardCandidates) },
    { name: "Norris Trophy", description: "Best defenseman", candidates: normalize(norrisCandidates) },
    { name: "Lady Byng Trophy", description: "Sportsmanship + high skill", candidates: normalize(ladyByngCandidates) },
  ];

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Trophy size={28} className="text-[var(--accent)]" />
          <h1 className="text-3xl font-bold text-[var(--text)]">Award Tracker</h1>
        </div>
        <p className="text-[var(--muted)] text-sm">
          Model-based projections using current season data. Updated every hour.
        </p>
      </div>

      <div className="space-y-8">
        {awards.map((award) => (
          <section key={award.name}>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-[var(--text)]">{award.name}</h2>
              <p className="text-xs text-[var(--muted)]">{award.description}</p>
            </div>

            <div className="space-y-3">
              {award.candidates.map((c, i) => (
                <Link
                  key={c.playerId}
                  href={`/player/${c.playerId}`}
                  className="stat-card flex items-center gap-4 hover:border-[var(--accent)] transition-colors group"
                >
                  {/* Rank */}
                  <span
                    className="text-sm font-black w-6 text-center flex-shrink-0"
                    style={{
                      color: i === 0 ? "var(--accent)" : "var(--muted)",
                    }}
                  >
                    #{i + 1}
                  </span>

                  {/* Headshot */}
                  <Image
                    src={c.headshot}
                    alt={c.name}
                    width={40}
                    height={40}
                    className="rounded-full object-cover bg-[var(--bg-elevated)] flex-shrink-0"
                  />

                  {/* Name + reasons */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors truncate">
                        {c.name}
                      </p>
                      <Image
                        src={c.teamLogo}
                        alt={c.teamAbbrev}
                        width={16}
                        height={16}
                        className="object-contain flex-shrink-0"
                      />
                      <span className="text-xs text-[var(--muted)]">{c.teamAbbrev}</span>
                    </div>
                    {c.reasons.length > 0 && (
                      <p className="text-xs text-[var(--muted)] truncate">{c.reasons.join(" · ")}</p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
                    {c.stats.map((s) => (
                      <div key={s.label} className="text-center">
                        <p className="text-xs font-bold text-[var(--text)]">{s.value}</p>
                        <p className="text-[10px] text-[var(--muted)]">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Likelihood bar */}
                  <div className="flex-shrink-0 w-24 hidden md:block">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-[var(--muted)]">likelihood</span>
                      <span
                        className="text-[10px] font-bold"
                        style={{ color: i === 0 ? "var(--accent)" : "var(--text)" }}
                      >
                        {Math.round(c.score)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${c.score}%`,
                          background: i === 0 ? "var(--accent)" : "var(--text-dim)",
                        }}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="text-[10px] text-[var(--muted)]">
        Projections are based on current season statistics and model weights — not official NHL voting.
        Vezina (best goalie) is omitted as goalie stats require additional data sources.
      </p>
    </div>
  );
}
