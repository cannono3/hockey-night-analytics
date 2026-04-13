/** Convert American odds to decimal odds */
export function americanToDecimal(american: number): number {
  if (!american || !isFinite(american) || american === 0) return 2.0; // fallback: even money
  return american > 0 ? american / 100 + 1 : 100 / Math.abs(american) + 1;
}

/** Convert American odds to raw implied probability (includes vig) */
function americanToRawProb(american: number): number {
  if (!american || !isFinite(american) || american === 0) return 0.5;
  return american > 0
    ? 100 / (american + 100)
    : Math.abs(american) / (Math.abs(american) + 100);
}

/**
 * Remove the bookmaker's vig from a two-outcome market.
 * Returns fair (no-vig) implied probabilities.
 */
export function removeVig(
  homeAmerican: number,
  awayAmerican: number
): { home: number; away: number } {
  const rawHome = americanToRawProb(homeAmerican);
  const rawAway = americanToRawProb(awayAmerican);
  const overround = rawHome + rawAway; // > 1.0 (the vig)
  return {
    home: rawHome / overround,
    away: rawAway / overround,
  };
}

/**
 * Edge = model probability − market no-vig implied probability.
 * Positive = model thinks this team is undervalued by the market.
 */
export function calcEdge(modelProb: number, impliedProb: number): number {
  return modelProb - impliedProb;
}

/**
 * Expected value per $1 staked.
 * Positive = profitable bet on average over many trials.
 * e.g. 0.08 means you expect to profit $8 per $100 bet.
 */
export function expectedValue(modelProbFraction: number, decimalOdds: number): number {
  return modelProbFraction * (decimalOdds - 1) - (1 - modelProbFraction);
}

/**
 * Quarter-Kelly stake as a fraction of bankroll.
 * Full Kelly is mathematically optimal but very aggressive;
 * quarter-Kelly reduces variance significantly.
 * Returns 0 if there is no edge.
 */
export function quarterKelly(
  modelProbFraction: number,
  decimalOdds: number
): number {
  const b = decimalOdds - 1; // net profit per unit staked
  const p = modelProbFraction;
  const q = 1 - p;
  const kelly = (b * p - q) / b;
  return Math.max(0, (kelly / 4) * 100); // as % of bankroll, floored at 0
}
