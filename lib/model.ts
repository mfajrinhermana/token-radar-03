// The token radar's model, version radar-4: one snapshot of the protocol universe in,
// one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling)
// and adds every other protocol that passes the watchlist's own launch-candidate rule:
// pre-token, and not a wrapped, staked or bridged product of a token that already trades.
// That rule is what keeps Binance staked ETH, WBTC and the bridges off the watchlist, and
// this board applies it to the early rows too, so no ranked row is a wrapped product.
// Two consequences, both stated in the dashboard: 48 pre-token protocols below the floor
// are left out (mostly liquid-staking and bridge products), and 20 pre-token protocols
// above the floor that the watchlist does not name are ranked anyway (e.g. protocols the
// watchlist's parent rule leaves out). Board: 198 rows.
//
// Implied value follows only from the snapshot's own figures. Four things are new
// against radar-2's single per-category median multiple:
//
//   1. TIERED CALIBRATION. Market-cap-per-TVL compresses as protocols get big: in this
//      snapshot Liquid Staking's live median is 0.186 below $100M of TVL and 0.013 above
//      $1B; Bridge's is 1.258 below $100M and 0.052 above $1B. A single per-category
//      median misprices both ends. radar-4 calibrates a multiple per (category, TVL
//      tier) from the snapshot's own live-token protocols, shrunk toward the category
//      median (k=3) and the category median shrunk toward the whole snapshot's median
//      (k=4), so no multiple ever rests on a thin sample. Clamped to [0.02, 1.5].
//   2. RELATIVE MOMENTUM. Absolute 7-day growth alone barely separates protocols when
//      the whole snapshot is down (median -8.23%): +5% scores 1.025 against -7%'s 0.965.
//      radar-4 also scores a protocol's growth percentile inside its own category:
//      +5% is the 91st percentile of pre-token growth here, and that is worth more
//      than +5% in a growing category. relMult = 0.85 + 0.30 x percentile.
//   3. LOG PATIENCE. radar-2's maturity grew linearly with age; radar-4 lets it grow
//      with the log of age, so each extra year matters less: a protocol that has run
//      four years with no token is patient, but the fifth year adds little.
//   4. BREADTH. A protocol on more chains reaches more users: +3% per extra chain,
//      capped at eight extra chains.
//
//   multiple   = tier multiple, shrunk as above, clamped [0.02, 1.5]
//   growthMult = (1 + 0.5 x clamp(change_7d, -60, 120) / 100) x (0.85 + 0.30 x pct)
//                (change unknown: 0 and percentile 0.5)
//   maturity   = 0.65 + 0.35 x ln(1 + age / 180) / ln(1 + 1460 / 180)
//                (age unknown: the snapshot's median pre-token age)
//   breadth    = 1 + 0.03 x min(chains - 1, 8)
//   implied    = max(1, round(tvl_usd x multiple x growthMult x maturity x breadth))
//
// No protocol name is ever special-cased: the same function scores every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  relative_floor: number;
  relative_range: number;
  min_category_samples: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_scale_days: number;
  maturity_cap_days: number;
  breadth_per_chain: number;
  breadth_max_extra: number;
  multiple_floor: number;
  multiple_cap: number;
  shrink_category: number;
  shrink_tier: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  relative_floor: 0.85,
  relative_range: 0.3,
  min_category_samples: 4,
  maturity_floor: 0.65,
  maturity_range: 0.35,
  maturity_scale_days: 180,
  maturity_cap_days: 1460,
  breadth_per_chain: 0.03,
  breadth_max_extra: 8,
  multiple_floor: 0.02,
  multiple_cap: 1.5,
  shrink_category: 4,
  shrink_tier: 3,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-4';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 40;

/** A TVL tier: small, mid, large. */
export type TvlTier = 'small' | 'mid' | 'large';

/** One entry of the calibration table the dashboard prints. */
export interface CalibrationRow {
  category: string;
  tier: TvlTier;
  multiple: number;
  live_protocols: number;
}

/** Everything the run-time calibration derives from the snapshot. */
export interface Calibration {
  overall_multiple: number;
  overall_samples: number;
  median_age_days: number;
  median_change_pct: number;
  by_category_tier: CalibrationRow[];
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  off_watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    tier: TvlTier;
    calibration_protocols: number;
    growth_pct: number;
    growth_multiplier: number;
    growth_relative_pct: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  tvl_rank: number;
  base_multiple: number;
  tier: TvlTier;
  calibration_protocols: number;
  growth_multiplier: number;
  growth_relative_pct: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  watchlist: boolean;
  off_watchlist: boolean;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  mcap_per_tvl: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  calibration: Calibration;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a list of numbers, or `fallback` when it holds none. */
function median(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories the watchlist rule keeps out: wrapped, staked or bridged products. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Exchange names the watchlist rule keeps out at the start of a name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

/** Whole words the watchlist rule keeps out anywhere in a name. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/**
 * Whether a protocol is one the board may rank: pre-token, and passing the watchlist's
 * own launch-candidate rule (minus the TVL floor). A wrapped, staked or bridged product
 * of a token that already trades is not a launch candidate, whatever its TVL.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The TVL tier a protocol's TVL falls in. */
export function tierOf(tvlUsd: number): TvlTier {
  if (tvlUsd < 100_000_000) return 'small';
  if (tvlUsd < 1_000_000_000) return 'mid';
  return 'large';
}

/**
 * The run-time calibration: for every (category, TVL tier), the median market-cap-per-TVL
 * of the snapshot's own live-token protocols in that cell, shrunk toward the category
 * median, which is itself shrunk toward the whole snapshot's median. A cell with no
 * live protocol at all takes its category's shrunk median; a category with none takes
 * the overall median. Multiples are clamped to a sane band.
 */
export function calibrate(snapshot: Snapshot, model: ModelConstants = MODEL): Calibration {
  const live = snapshot.protocols.filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const overall = median(
    live.map((p) => p.mcap_usd! / p.tvl_usd),
    0.25,
  );
  const clamp = (v: number): number => Math.min(model.multiple_cap, Math.max(model.multiple_floor, v));
  const byCategory = new Map<string, number[]>();
  const byCell = new Map<string, number[]>();
  for (const p of live) {
    const key = p.category ?? 'Uncategorised';
    const list = byCategory.get(key) ?? [];
    list.push(p.mcap_usd! / p.tvl_usd);
    byCategory.set(key, list);
    const cell = `${key}::${tierOf(p.tvl_usd)}`;
    const cellList = byCell.get(cell) ?? [];
    cellList.push(p.mcap_usd! / p.tvl_usd);
    byCell.set(cell, cellList);
  }
  const catMultiple = (category: string): number => {
    const values = byCategory.get(category) ?? [];
    const raw = median(values, overall);
    return (values.length * raw + model.shrink_category * overall) / (values.length + model.shrink_category);
  };
  const rows: CalibrationRow[] = [];
  const categories = [...new Set(snapshot.protocols.map((p) => p.category ?? 'Uncategorised'))].sort();
  for (const category of categories) {
    for (const tier of ['small', 'mid', 'large'] as TvlTier[]) {
      const cell = byCell.get(`${category}::${tier}`) ?? [];
      const cat = catMultiple(category);
      const raw = median(cell, cat);
      const multiple = (cell.length * raw + model.shrink_tier * cat) / (cell.length + model.shrink_tier);
      rows.push({ category, tier, multiple: clamp(multiple), live_protocols: cell.length });
    }
  }
  const preAges = snapshot.protocols
    .filter((p) => isPreToken(p))
    .map((p) => ageDays(snapshot.as_of, p.listed_at))
    .filter((a): a is number => a !== null);
  const allChanges = snapshot.protocols.map((p) => p.change_7d).filter((c): c is number => c !== null);
  return {
    overall_multiple: clamp(overall),
    overall_samples: live.length,
    median_age_days: Math.round(median(preAges, 365)),
    median_change_pct: median(allChanges, 0),
    by_category_tier: rows,
  };
}

/** A category and tier's calibrated multiple, with the live sample count behind it. */
export function multipleFor(category: string | null, tier: TvlTier, calibration: Calibration): { multiple: number; samples: number } {
  const key = category ?? 'Uncategorised';
  const row = calibration.by_category_tier.find((r) => r.category === key && r.tier === tier);
  if (row !== undefined) return { multiple: row.multiple, samples: row.live_protocols };
  return { multiple: calibration.overall_multiple, samples: calibration.overall_samples };
}

/**
 * The growth percentile of one protocol's 7-day change inside its own category: the
 * share of protocols in the category (live and pre-token) whose reported change it
 * beats, with ties split. Categories with too few reported changes fall back to the
 * whole snapshot. A protocol with no reported change sits at the middle.
 */
export function growthPercentile(protocol: SnapshotProtocol, snapshot: Snapshot, model: ModelConstants = MODEL): number {
  const key = protocol.category ?? 'Uncategorised';
  const inCategory = snapshot.protocols.filter((p) => (p.category ?? 'Uncategorised') === key && p.change_7d !== null);
  const pool = inCategory.length >= model.min_category_samples ? inCategory : snapshot.protocols.filter((p) => p.change_7d !== null);
  if (protocol.change_7d === null || pool.length === 0) return 0.5;
  const c = protocol.change_7d;
  let below = 0;
  let equal = 0;
  for (const p of pool) {
    if (p.change_7d! < c) below++;
    else if (p.change_7d! === c) equal++;
  }
  return (below + 0.5 * equal) / pool.length;
}

/** The multipliers and the implied value one protocol gets under `model` and `calibration`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  snapshot: Snapshot,
  calibration: Calibration,
  model: ModelConstants = MODEL,
): {
  implied: number;
  multiple: number;
  samples: number;
  tier: TvlTier;
  growthPct: number;
  growthMult: number;
  growthRelPct: number;
  maturityMult: number;
  breadthMult: number;
  age: number | null;
} {
  const age = ageDays(snapshot.as_of, protocol.listed_at);
  const tier = tierOf(protocol.tvl_usd);
  const { multiple, samples } = multipleFor(protocol.category, tier, calibration);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const absMult = 1 + (growthPct / 100) * model.growth_weight;
  const growthRelPct = growthPercentile(protocol, snapshot, model);
  const relMult = model.relative_floor + model.relative_range * growthRelPct;
  const growthMult = absMult * relMult;
  const ageForModel = age ?? calibration.median_age_days;
  const cappedAge = Math.min(Math.max(ageForModel, 0), model.maturity_cap_days);
  const maturityMult =
    model.maturity_floor +
    (model.maturity_range * Math.log(1 + cappedAge / model.maturity_scale_days)) /
      Math.log(1 + model.maturity_cap_days / model.maturity_scale_days);
  const breadthMult = 1 + model.breadth_per_chain * Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_extra);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult * maturityMult * breadthMult));
  return { implied, multiple, samples, tier, growthPct, growthMult, growthRelPct, maturityMult, breadthMult, age };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const calibration = calibrate(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other protocol that passes the launch-candidate rule,
  // below the floor or above it. Never a replacement for a watchlist row.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const watch = new Set(snapshot.watchlist);
  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot, calibration, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    watchlist: watch.has(s.p.slug),
    off_watchlist: !watch.has(s.p.slug),
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_multiple: round4(s.multiple),
      tier: s.tier,
      calibration_protocols: s.samples,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      growth_relative_pct: round4(s.growthRelPct),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age, s.growthRelPct).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** What one simple transaction costs on a chain, in whole dollars, as a planning figure. */
function gasUsd(chain: string): number {
  const c = chain.toLowerCase();
  if (c === 'solana') return 0.01;
  if (c === 'sui') return 0.05;
  if (c === 'aptos') return 0.02;
  if (c === 'bitcoin') return 0.05;
  if (c === 'tron') return 2;
  if (c === 'ethereum') return 4;
  if (c === 'avalanche') return 0.3;
  if (c === 'bsc' || c === 'binance' || c === 'bnb chain') return 0.15;
  if (
    ['base', 'arbitrum', 'optimism', 'ink', 'unichain', 'blast', 'linea', 'scroll', 'mode', 'zora', 'fraxtal', 'berachain', 'polygon zkevm', 'world chain', 'opbnb', 'op', 'celo', 'gnosis', 'fantom', 'moonbeam', 'polygon'].includes(c)
  )
    return 0.1;
  return 0.5;
}

/** The cheapest chain a protocol names, for the first transaction, or a neutral phrase. */
function cheapestChain(p: SnapshotProtocol): { chain: string; gas: number } {
  if (p.chains.length === 0) return { chain: 'its main chain', gas: 0.5 };
  let best = p.chains[0]!;
  let bestGas = gasUsd(best);
  for (const c of p.chains) {
    const g = gasUsd(c);
    if (g < bestGas) {
      best = c;
      bestGas = g;
    }
  }
  return { chain: best, gas: bestGas };
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/**
 * How long to hold, from the protocol's momentum and age: a cooling protocol and a
 * young one both get a longer qualifying window, so the activity is counted in more
 * than one snapshot. Capped at 60 days.
 */
function holdDaysFor(age: number | null, growthRelPct: number): number {
  let hold = 30;
  if (growthRelPct < 0.4) hold += 15;
  if (age !== null && age < 180) hold += 15;
  if (age === null) hold += 15;
  return Math.min(hold, 60);
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and borrow a small amount against it, then repay the borrow before the snapshot window ends.`;
  if (c.includes('uncollateralized')) return `Lend $${capital} of USDC through ${name} on ${chain} to a whitelisted borrower pool and keep the loan open.`;
  if (c.includes('dex')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} in a narrow range and collect the trading fees.`;
  if (c.includes('leveraged farm') || c.includes('yield aggregator') || c.includes('yield')) return `Deposit $${capital} of USDC into ${name}'s highest-TVL vault on ${chain} and let the strategy compound.`;
  if (c.includes('liquid staking') || c.includes('restak') || c.includes('staking pool')) return `Stake $${capital} of the chain's staking asset through ${name} and hold the receipt token in your wallet.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge $${capital} of USDC to ${chain} through ${name}, then use the bridged funds once inside its app.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trading')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position, then close it the same week.`;
  if (c.includes('risk curator') || c.includes('capital allocator') || c.includes('onchain capital')) return `Deposit $${capital} into a ${name} curated vault on ${chain} and hold the vault shares.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} through ${name} and hold it.`;
  if (c.includes('stablecoin')) return `Mint $${capital} of the stable asset through ${name} on ${chain} and keep it in the wallet.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one small market position on ${name}, then settle it.`;
  if (c.includes('payment') || c.includes('card issuer')) return `Open a payment channel with $${capital} through ${name} on ${chain} and route one payment.`;
  if (c.includes('chain')) return `Delegate or stake $${capital} of the chain's native asset through ${name} and keep the stake.`;
  if (c.includes('governance')) return `Lock $${capital} in ${name}'s governance on ${chain} and vote on one live proposal.`;
  if (c.includes('privacy')) return `Shield $${capital} through ${name}'s private pool on ${chain} and withdraw it after one day.`;
  if (c.includes('launchpad')) return `Commit $${capital} to one live launch on ${name} on ${chain} and hold the allocation.`;
  if (c.includes('otc') || c.includes('marketplace')) return `Place one $${capital} order on ${name} on ${chain} and settle it through the escrow.`;
  if (c.includes('farm')) return `Stake $${capital} of LP tokens in ${name}'s farm on ${chain} and harvest the rewards weekly.`;
  if (c.includes('index')) return `Buy $${capital} of the ${name} index on ${chain} and hold the index token.`;
  if (c.includes('interest rate')) return `Open a $${capital} fixed-rate position on ${name} on ${chain} and hold it to maturity.`;
  if (c.includes('anchor') || c.includes('decentralized btc') || c.includes('restaked btc')) return `Deposit $${capital} of BTC-backed collateral through ${name} on ${chain} and keep the position open.`;
  if (c.includes('dual-token')) return `Mint $${capital} of the yield token through ${name} on ${chain} and hold it beside the stable leg.`;
  if (c.includes('cedefi')) return `Deposit $${capital} of USDC into ${name}'s CeDeFi vault on ${chain} and hold the vault shares.`;
  if (c.includes('liquidity manager')) return `Deposit $${capital} into a ${name} managed liquidity position on ${chain} and let it rebalance.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age, momentum), never
 * from a hand-written list of names. Gas figures are planning estimates for one simple
 * transaction on the protocol's cheapest chain.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, growthRelPct: number): FarmStep[] {
  const { chain, gas } = cheapestChain(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age, growthRelPct);
  const gasText = gas < 0.05 ? 'under $0.05 of gas' : `about $${gas} of gas`;
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `under $3 of gas for the first transaction on ${chain}`,
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gasText}`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week on ${chain}, such as a deposit, a borrow, a swap or a vote.`,
      cost: `${gasText} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      mcap_per_tvl: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow, tvlRank: number): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    tvl_rank: tvlRank,
    base_multiple: row.model.base_multiple,
    tier: row.model.tier,
    calibration_protocols: row.model.calibration_protocols,
    growth_multiplier: row.model.growth_multiplier,
    growth_relative_pct: row.model.growth_relative_pct,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    watchlist: row.watchlist,
    off_watchlist: row.off_watchlist,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const calibration = calibrate(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !r.watchlist).length;
  const byTvl = [...board].sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));
  const tvlRank = new Map(byTvl.map((r, i) => [r.slug, i + 1]));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    calibration,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, tvlRank.get(r.slug)!)),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
