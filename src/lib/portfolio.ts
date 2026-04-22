import { format, formatDistanceToNowStrict, parseISO, subDays, subYears } from "date-fns";

import type { BenchmarkHistoryPoint } from "@/lib/benchmark";
import { getBenchmarkHistory } from "@/lib/benchmark";
import { getAppSettings, getDatabase } from "@/lib/db";
import type {
  ContributionInput,
  ContributionUpdateInput,
  TrackedInstrumentInput,
  TrackedInstrumentUpdateInput,
  TransactionInput,
} from "@/lib/schemas";

type TransactionRow = {
  id: number;
  symbol: string;
  name: string;
  asset_type: "stock" | "etf" | "fund";
  operation: "buy" | "sell";
  quantity: number;
  price: number;
  fee: number;
  currency: string;
  fx_rate_to_eur: number;
  trade_date: string;
  created_at: string;
};

type QuoteRow = {
  symbol: string;
  short_name: string;
  currency: string;
  price: number;
  previous_close: number | null;
  change_percent: number | null;
  exchange_name: string | null;
  fetched_at: string;
};

type SnapshotRow = {
  captured_at: string;
  total_value_eur: number;
  total_cost_eur: number;
  total_pl_eur: number;
  benchmark_symbol: string;
  benchmark_price_eur: number | null;
};

type TrackedInstrumentRow = {
  id: number;
  symbol: string;
  name: string;
  asset_type: "stock" | "etf" | "fund";
  start_date: string;
  start_date_precision: "exact" | "estimated";
  end_date: string | null;
  initial_amount_eur: number;
  current_amount_eur: number;
  basis_amount_eur: number;
  estimated_contributions_eur: number;
  total_return_percent: number;
  is_active: number;
  return_precision: "exact" | "estimated";
  inferred_units: number | null;
  last_market_value_eur: number | null;
  last_price_eur: number | null;
  last_updated: string | null;
  created_at: string;
};

type InstrumentFlowRow = {
  id: number;
  tracked_instrument_id: number;
  flow_date: string;
  flow_type: "contribution" | "withdrawal";
  amount_eur: number;
  inferred_units_delta: number | null;
  created_at: string;
};

export type LiveQuoteInput = {
  currentPriceEur: number;
  currentPriceNative: number;
  fetchedAt: string;
  changePercent: number | null;
};

export type Holding = {
  id: number;
  symbol: string;
  name: string;
  assetType: "stock" | "etf" | "fund";
  status: "active" | "inactive";
  startDate: string;
  startDatePrecision: "exact" | "estimated";
  endDate: string | null;
  initialAmountEur: number;
  currentAmountEur: number;
  basisAmountEur: number;
  historicalEstimatedContributionsEur: number;
  futureNetFlowsEur: number;
  totalContributionsEur: number;
  plEur: number;
  plPercent: number;
  weight: number;
  totalReturnPercent: number;
  returnPrecision: "exact" | "estimated";
  lastUpdated: string | null;
  dayChangePercent: number | null;
};

type PerformancePoint = {
  date: string;
  label: string;
  portfolioValue: number;
  totalCost: number;
  portfolioIndex: number | null;
  benchmarkIndex: number | null;
};

type HoldingPerformancePoint = {
  date: string;
  label: string;
  [symbol: string]: number | string | null;
};

type PerformanceSeedPoint = {
  date: Date;
  portfolioValue: number;
  totalCost: number;
};

export type DashboardData = {
  summary: {
    totalValueEur: number;
    totalCostEur: number;
    totalPlEur: number;
    totalPlPercent: number;
    positions: number;
    activePositions: number;
    inactivePositions: number;
    totalFutureFlowsEur: number;
    lastUpdated: string | null;
    lastUpdatedHuman: string;
    benchmarkSymbol: string;
    portfolioIndex: number | null;
    benchmarkIndex: number | null;
    benchmarkDelta: number | null;
    periodReturns: {
      day: number | null;
      week: number | null;
      month: number | null;
      year: number | null;
      sinceStart: number | null;
    };
  };
  holdings: Holding[];
  allocation: Array<{
    symbol: string;
    name: string;
    value: number;
    weight: number;
  }>;
  performanceSeries: Array<{
    date: string;
    label: string;
    portfolioValue: number;
    totalCost: number;
    portfolioIndex: number | null;
    benchmarkIndex: number | null;
  }>;
  holdingPerformanceSeries: HoldingPerformancePoint[];
  latestTransactions: Array<{
    id: number;
    symbol: string;
    operation: "buy" | "sell";
    quantity: number;
    price: number;
    currency: string;
    tradeDate: string;
  }>;
  latestFlows: Array<{
    id: number;
    trackedInstrumentId: number;
    symbol: string;
    name: string;
    flowType: "contribution" | "withdrawal";
    amountEur: number;
    flowDate: string;
  }>;
  settings: {
    baseCurrency: string;
    benchmarkSymbol: string;
  };
  staleSymbols: string[];
};

function getTransactions() {
  const db = getDatabase();
  return db
    .prepare(
      `
        SELECT id, symbol, name, asset_type, operation, quantity, price, fee, currency, fx_rate_to_eur, trade_date, created_at
        FROM transactions
        ORDER BY trade_date ASC, id ASC
      `,
    )
    .all() as TransactionRow[];
}

function getQuotes() {
  const db = getDatabase();
  return db
    .prepare(
      `
        SELECT symbol, short_name, currency, price, previous_close, change_percent, exchange_name, fetched_at
        FROM market_quotes
      `,
    )
    .all() as QuoteRow[];
}

function getSnapshots() {
  const db = getDatabase();
  return db
    .prepare(
      `
        SELECT captured_at, total_value_eur, total_cost_eur, total_pl_eur, benchmark_symbol, benchmark_price_eur
        FROM portfolio_snapshots
        ORDER BY captured_at ASC
      `,
    )
    .all() as SnapshotRow[];
}

function getTrackedInstrumentRows() {
  const db = getDatabase();
  return db
    .prepare(
      `
        SELECT
          id,
          symbol,
          name,
          asset_type,
          start_date,
          start_date_precision,
          end_date,
          initial_amount_eur,
          current_amount_eur,
          basis_amount_eur,
          estimated_contributions_eur,
          total_return_percent,
          is_active,
          return_precision,
          inferred_units,
          last_market_value_eur,
          last_price_eur,
          last_updated,
          created_at
        FROM tracked_instruments
        ORDER BY created_at ASC, id ASC
      `,
    )
    .all() as TrackedInstrumentRow[];
}

function getInstrumentFlows() {
  const db = getDatabase();
  return db
    .prepare(
      `
        SELECT id, tracked_instrument_id, flow_date, flow_type, amount_eur, inferred_units_delta, created_at
        FROM tracked_instrument_flows
        ORDER BY flow_date ASC, id ASC
      `,
    )
    .all() as InstrumentFlowRow[];
}

function latestIso(items: Array<{ fetched_at: string }>) {
  if (items.length === 0) {
    return null;
  }

  return items.reduce((latest, item) => (item.fetched_at > latest ? item.fetched_at : latest), items[0].fetched_at);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function clampProgress(progress: number) {
  if (progress <= 0) {
    return 0;
  }

  if (progress >= 1) {
    return 1;
  }

  return progress;
}

function interpolateValue(start: number, end: number, progress: number) {
  return start + (end - start) * clampProgress(progress);
}

function toDayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function getEarliestTrackedStartDate(trackedRows: TrackedInstrumentRow[]) {
  const startDates = trackedRows
    .map((row) => startOfDay(parseISO(row.start_date)))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());

  return startDates[0] ?? null;
}

function buildEstimatedPerformanceSeries(
  trackedRows: TrackedInstrumentRow[],
  flowMap: Map<number, InstrumentFlowRow[]>,
  benchmarkHistory: BenchmarkHistoryPoint[],
): PerformancePoint[] {
  if (trackedRows.length === 0) {
    return [];
  }

  const datedRows = trackedRows
    .map((row) => ({
      row,
      startDate: startOfDay(parseISO(row.start_date)),
      endDate: row.end_date ? startOfDay(parseISO(row.end_date)) : null,
      finalValue: row.is_active === 1 ? row.last_market_value_eur ?? row.current_amount_eur : row.current_amount_eur,
      baseFinalCost: row.basis_amount_eur,
      flows: (flowMap.get(row.id) ?? [])
        .map((flow) => ({
          amount: flow.amount_eur,
          date: startOfDay(parseISO(flow.flow_date)),
        }))
        .filter((flow) => !Number.isNaN(flow.date.getTime()))
        .sort((left, right) => left.date.getTime() - right.date.getTime()),
    }))
    .filter((entry) => !Number.isNaN(entry.startDate.getTime()));

  if (datedRows.length === 0) {
    return [];
  }

  const firstStart = datedRows.reduce(
    (earliest, entry) => (entry.startDate.getTime() < earliest.getTime() ? entry.startDate : earliest),
    datedRows[0].startDate,
  );
  const today = startOfDay(new Date());
  const finalDate = today.getTime() < firstStart.getTime() ? firstStart : today;
  const series: PerformanceSeedPoint[] = [];

  for (let cursor = new Date(firstStart); cursor.getTime() <= finalDate.getTime(); cursor.setDate(cursor.getDate() + 1)) {
    let portfolioValue = 0;
    let totalCost = 0;

    for (const entry of datedRows) {
      if (cursor.getTime() < entry.startDate.getTime()) {
        continue;
      }

      const instrumentEnd = entry.endDate ?? finalDate;
      const totalDuration = Math.max(instrumentEnd.getTime() - entry.startDate.getTime(), 1);
      const elapsed = Math.min(cursor.getTime(), instrumentEnd.getTime()) - entry.startDate.getTime();
      const progress = clampProgress(elapsed / totalDuration);
      const realFlowTotal = entry.flows.reduce((sum, flow) => sum + flow.amount, 0);
      const cumulativeRealFlows = entry.flows.reduce(
        (sum, flow) => (flow.date.getTime() <= cursor.getTime() ? sum + flow.amount : sum),
        0,
      );
      const baseFinalValue = entry.finalValue - realFlowTotal;

      portfolioValue += interpolateValue(entry.row.initial_amount_eur, baseFinalValue, progress) + cumulativeRealFlows;
      totalCost += interpolateValue(entry.row.initial_amount_eur, entry.baseFinalCost, progress) + cumulativeRealFlows;
    }

    series.push({
      date: new Date(cursor),
      portfolioValue,
      totalCost,
    });
  }

  return buildPerformanceSeriesFromSeed(series, benchmarkHistory);
}

function buildPerformanceSeriesFromSeed(
  seedPoints: PerformanceSeedPoint[],
  benchmarkHistory: BenchmarkHistoryPoint[],
): PerformancePoint[] {
  if (seedPoints.length === 0) {
    return [];
  }

  const sortedSeedPoints = [...seedPoints].sort((left, right) => left.date.getTime() - right.date.getTime());
  const sortedBenchmarkHistory = [...benchmarkHistory].sort((left, right) => left.date.getTime() - right.date.getTime());

  let benchmarkPointer = 0;
  let latestBenchmarkPrice: number | null = null;
  let pendingBenchmarkCash = 0;
  let benchmarkUnits = 0;
  let previousPortfolioIndex: number | null = null;
  let previousBenchmarkIndex: number | null = null;
  let previousPortfolioValue: number | null = null;
  let previousBenchmarkValue: number | null = null;
  let previousTotalCost = 0;

  return sortedSeedPoints.map((point) => {
    const pointKey = toDayKey(point.date);

    while (benchmarkPointer < sortedBenchmarkHistory.length && toDayKey(sortedBenchmarkHistory[benchmarkPointer].date) <= pointKey) {
      latestBenchmarkPrice = sortedBenchmarkHistory[benchmarkPointer].close;
      benchmarkPointer += 1;
    }

    const flowDelta = point.totalCost - previousTotalCost;
    previousTotalCost = point.totalCost;
    pendingBenchmarkCash += flowDelta;

    if (latestBenchmarkPrice && pendingBenchmarkCash !== 0) {
      benchmarkUnits += pendingBenchmarkCash / latestBenchmarkPrice;
      pendingBenchmarkCash = 0;
    }

    const benchmarkValue = latestBenchmarkPrice ? benchmarkUnits * latestBenchmarkPrice : null;

    let portfolioIndex = previousPortfolioIndex;
    if (point.portfolioValue > 0) {
      if (portfolioIndex === null || previousPortfolioValue === null || previousPortfolioValue <= 0) {
        portfolioIndex = 100;
      } else {
        const periodFactor = (point.portfolioValue - flowDelta) / previousPortfolioValue;
        portfolioIndex *= Number.isFinite(periodFactor) && periodFactor > 0 ? periodFactor : 1;
      }
    }

    let benchmarkIndex = previousBenchmarkIndex;
    if (benchmarkValue !== null && benchmarkValue > 0) {
      if (benchmarkIndex === null || previousBenchmarkValue === null || previousBenchmarkValue <= 0) {
        benchmarkIndex = 100;
      } else {
        const periodFactor = (benchmarkValue - flowDelta) / previousBenchmarkValue;
        benchmarkIndex *= Number.isFinite(periodFactor) && periodFactor > 0 ? periodFactor : 1;
      }
    }

    previousPortfolioIndex = portfolioIndex;
    previousBenchmarkIndex = benchmarkIndex;
    previousPortfolioValue = point.portfolioValue;
    previousBenchmarkValue = benchmarkValue;

    return {
      date: point.date.toISOString(),
      label: format(point.date, "dd MMM"),
      portfolioValue: point.portfolioValue,
      totalCost: point.totalCost,
      portfolioIndex,
      benchmarkIndex,
    };
  });
}

function buildSnapshotPerformanceSeries(snapshots: SnapshotRow[]) {
  const seedPoints = snapshots.map((snapshot) => ({
    date: parseISO(snapshot.captured_at),
    portfolioValue: snapshot.total_value_eur,
    totalCost: snapshot.total_cost_eur,
  }));
  const benchmarkHistory = snapshots
    .filter((snapshot) => (snapshot.benchmark_price_eur ?? 0) > 0)
    .map((snapshot) => ({
      date: parseISO(snapshot.captured_at),
      close: snapshot.benchmark_price_eur ?? 0,
    }));

  return buildPerformanceSeriesFromSeed(seedPoints, benchmarkHistory);
}

function getSeriesReferencePoint(series: PerformancePoint[], targetDate: Date) {
  const targetTime = targetDate.getTime();
  const eligible = series.filter((point) => new Date(point.date).getTime() <= targetTime);
  return eligible.at(-1) ?? series[0] ?? null;
}

function buildHoldingPerformanceSeries(
  trackedRows: TrackedInstrumentRow[],
  flowMap: Map<number, InstrumentFlowRow[]>,
): HoldingPerformancePoint[] {
  if (trackedRows.length === 0) {
    return [];
  }

  const datedRows = trackedRows
    .map((row) => ({
      row,
      startDate: startOfDay(parseISO(row.start_date)),
      endDate: row.end_date ? startOfDay(parseISO(row.end_date)) : null,
      finalValue: row.is_active === 1 ? row.last_market_value_eur ?? row.current_amount_eur : row.current_amount_eur,
      flows: (flowMap.get(row.id) ?? [])
        .map((flow) => ({
          amount: flow.amount_eur,
          date: startOfDay(parseISO(flow.flow_date)),
        }))
        .filter((flow) => !Number.isNaN(flow.date.getTime()))
        .sort((left, right) => left.date.getTime() - right.date.getTime()),
    }))
    .filter((entry) => !Number.isNaN(entry.startDate.getTime()));

  if (datedRows.length === 0) {
    return [];
  }

  const firstStart = datedRows.reduce(
    (earliest, entry) => (entry.startDate.getTime() < earliest.getTime() ? entry.startDate : earliest),
    datedRows[0].startDate,
  );
  const today = startOfDay(new Date());
  const finalDate = today.getTime() < firstStart.getTime() ? firstStart : today;
  const series: HoldingPerformancePoint[] = [];

  for (let cursor = new Date(firstStart); cursor.getTime() <= finalDate.getTime(); cursor.setDate(cursor.getDate() + 1)) {
    const point: HoldingPerformancePoint = {
      date: new Date(cursor).toISOString(),
      label: format(cursor, "dd MMM"),
    };

    for (const entry of datedRows) {
      if (cursor.getTime() < entry.startDate.getTime()) {
        point[entry.row.symbol] = null;
        continue;
      }

      const instrumentEnd = entry.endDate ?? finalDate;
      const totalDuration = Math.max(instrumentEnd.getTime() - entry.startDate.getTime(), 1);
      const elapsed = Math.min(cursor.getTime(), instrumentEnd.getTime()) - entry.startDate.getTime();
      const progress = clampProgress(elapsed / totalDuration);
      const realFlowTotal = entry.flows.reduce((sum, flow) => sum + flow.amount, 0);
      const cumulativeRealFlows = entry.flows.reduce(
        (sum, flow) => (flow.date.getTime() <= cursor.getTime() ? sum + flow.amount : sum),
        0,
      );
      const baseFinalValue = entry.finalValue - realFlowTotal;

      point[entry.row.symbol] = interpolateValue(entry.row.initial_amount_eur, baseFinalValue, progress) + cumulativeRealFlows;
    }

    series.push(point);
  }

  return series;
}

export function createTransaction(input: TransactionInput) {
  const db = getDatabase();

  const result = db
    .prepare(
      `
        INSERT INTO transactions (
          symbol, name, asset_type, operation, quantity, price, fee, currency, fx_rate_to_eur, trade_date
        ) VALUES (
          @symbol, @name, @assetType, @operation, @quantity, @price, @fee, @currency, @fxRateToEur, @tradeDate
        )
      `,
    )
    .run(input);

  return result.lastInsertRowid;
}

export function createTrackedInstrument(input: TrackedInstrumentInput, liveQuote?: LiveQuoteInput | null) {
  const db = getDatabase();
  const returnFactor = 1 + input.totalReturnPercent / 100;

  if (returnFactor <= 0) {
    throw new Error("La rentabilidad total debe ser mayor que -100%.");
  }

  const basisAmountEur = input.currentAmountEur / returnFactor;
  const estimatedContributionsEur = basisAmountEur - input.initialAmountEur;
  const inferredUnits =
    input.isActive && liveQuote && liveQuote.currentPriceEur > 0
      ? input.currentAmountEur / liveQuote.currentPriceEur
      : null;

  const result = db
    .prepare(
      `
        INSERT INTO tracked_instruments (
          symbol,
          name,
          asset_type,
          start_date,
          start_date_precision,
          end_date,
          initial_amount_eur,
          current_amount_eur,
          basis_amount_eur,
          estimated_contributions_eur,
          total_return_percent,
          is_active,
          return_precision,
          inferred_units,
          last_market_value_eur,
          last_price_eur,
          last_updated
        ) VALUES (
          @symbol,
          @name,
          @assetType,
          @startDate,
          @startDatePrecision,
          @endDate,
          @initialAmountEur,
          @currentAmountEur,
          @basisAmountEur,
          @estimatedContributionsEur,
          @totalReturnPercent,
          @isActive,
          @returnPrecision,
          @inferredUnits,
          @lastMarketValueEur,
          @lastPriceEur,
          @lastUpdated
        )
      `,
    )
    .run({
      symbol: input.symbol,
      name: input.name,
      assetType: input.assetType,
      startDate: input.startDate,
      startDatePrecision: input.startDatePrecision,
      endDate: input.endDate || null,
      initialAmountEur: input.initialAmountEur,
      currentAmountEur: input.currentAmountEur,
      basisAmountEur,
      estimatedContributionsEur,
      totalReturnPercent: input.totalReturnPercent,
      isActive: input.isActive ? 1 : 0,
      returnPrecision: input.returnPrecision,
      inferredUnits,
      lastMarketValueEur: input.isActive ? input.currentAmountEur : null,
      lastPriceEur: liveQuote?.currentPriceEur ?? null,
      lastUpdated: liveQuote?.fetchedAt ?? null,
    });

  return result.lastInsertRowid;
}

export function updateTrackedInstrument(input: TrackedInstrumentUpdateInput, liveQuote?: LiveQuoteInput | null) {
  const db = getDatabase();
  const existing = db
    .prepare(
      `
        SELECT id, symbol, last_price_eur, last_updated
        FROM tracked_instruments
        WHERE id = ?
      `,
    )
    .get(input.id) as
    | {
        id: number;
        symbol: string;
        last_price_eur: number | null;
        last_updated: string | null;
      }
    | undefined;

  if (!existing) {
    throw new Error("No existe el instrumento indicado.");
  }

  const returnFactor = 1 + input.totalReturnPercent / 100;

  if (returnFactor <= 0) {
    throw new Error("La rentabilidad total debe ser mayor que -100%.");
  }

  const basisAmountEur = input.currentAmountEur / returnFactor;
  const estimatedContributionsEur = basisAmountEur - input.initialAmountEur;
  const priceForUnits = liveQuote?.currentPriceEur ?? existing.last_price_eur;
  const inferredUnits =
    input.isActive && priceForUnits && priceForUnits > 0 ? input.currentAmountEur / priceForUnits : null;

  db.prepare(
    `
      UPDATE tracked_instruments
      SET
        symbol = @symbol,
        name = @name,
        asset_type = @assetType,
        start_date = @startDate,
        start_date_precision = @startDatePrecision,
        end_date = @endDate,
        initial_amount_eur = @initialAmountEur,
        current_amount_eur = @currentAmountEur,
        basis_amount_eur = @basisAmountEur,
        estimated_contributions_eur = @estimatedContributionsEur,
        total_return_percent = @totalReturnPercent,
        is_active = @isActive,
        return_precision = @returnPrecision,
        inferred_units = @inferredUnits,
        last_market_value_eur = @lastMarketValueEur,
        last_price_eur = @lastPriceEur,
        last_updated = @lastUpdated
      WHERE id = @id
    `,
  ).run({
    id: input.id,
    symbol: input.symbol,
    name: input.name,
    assetType: input.assetType,
    startDate: input.startDate,
    startDatePrecision: input.startDatePrecision,
    endDate: input.endDate || null,
    initialAmountEur: input.initialAmountEur,
    currentAmountEur: input.currentAmountEur,
    basisAmountEur,
    estimatedContributionsEur,
    totalReturnPercent: input.totalReturnPercent,
    isActive: input.isActive ? 1 : 0,
    returnPrecision: input.returnPrecision,
    inferredUnits,
    lastMarketValueEur: input.isActive ? input.currentAmountEur : null,
    lastPriceEur: input.isActive ? priceForUnits ?? null : existing.last_price_eur,
    lastUpdated: input.isActive ? liveQuote?.fetchedAt ?? existing.last_updated ?? new Date().toISOString() : existing.last_updated,
  });

  return input.id;
}

export function createInstrumentFlow(input: ContributionInput, liveQuote?: LiveQuoteInput | null) {
  const db = getDatabase();
  const instrument = db
    .prepare(
      `
        SELECT id, is_active, inferred_units, current_amount_eur, last_market_value_eur
        FROM tracked_instruments
        WHERE id = ?
      `,
    )
    .get(input.trackedInstrumentId) as
    | {
        id: number;
        is_active: number;
        inferred_units: number | null;
        current_amount_eur: number;
        last_market_value_eur: number | null;
      }
    | undefined;

  if (!instrument) {
    throw new Error("No existe el instrumento indicado.");
  }

  if (instrument.is_active !== 1) {
    throw new Error("No puedes anadir aportaciones a un instrumento cerrado.");
  }

  const signedAmount = input.flowType === "contribution" ? input.amountEur : -input.amountEur;
  const inferredUnitsDelta =
    liveQuote && liveQuote.currentPriceEur > 0 ? signedAmount / liveQuote.currentPriceEur : null;

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `
          INSERT INTO tracked_instrument_flows (
            tracked_instrument_id, flow_date, flow_type, amount_eur, inferred_units_delta
          ) VALUES (
            @trackedInstrumentId, @flowDate, @flowType, @amountEur, @inferredUnitsDelta
          )
        `,
      )
      .run({
        trackedInstrumentId: input.trackedInstrumentId,
        flowDate: input.flowDate,
        flowType: input.flowType,
        amountEur: signedAmount,
        inferredUnitsDelta,
      });

    db.prepare(
      `
        UPDATE tracked_instruments
        SET
          inferred_units = CASE
            WHEN @inferredUnitsDelta IS NOT NULL THEN COALESCE(inferred_units, 0) + @inferredUnitsDelta
            ELSE inferred_units
          END,
          current_amount_eur = current_amount_eur + @signedAmount,
          last_market_value_eur = COALESCE(last_market_value_eur, current_amount_eur) + @signedAmount,
          last_updated = @lastUpdated
        WHERE id = @trackedInstrumentId
      `,
    ).run({
      trackedInstrumentId: input.trackedInstrumentId,
      inferredUnitsDelta,
      signedAmount,
      lastUpdated: liveQuote?.fetchedAt ?? new Date().toISOString(),
    });

    return result.lastInsertRowid;
  });

  return tx();
}

export function updateInstrumentFlow(input: ContributionUpdateInput, liveQuote?: LiveQuoteInput | null) {
  const db = getDatabase();
  const existing = db
    .prepare(
      `
        SELECT
          flow.id,
          flow.tracked_instrument_id,
          flow.amount_eur,
          flow.inferred_units_delta,
          instrument.is_active,
          instrument.inferred_units,
          instrument.current_amount_eur,
          instrument.last_market_value_eur
        FROM tracked_instrument_flows flow
        INNER JOIN tracked_instruments instrument ON instrument.id = flow.tracked_instrument_id
        WHERE flow.id = ?
      `,
    )
    .get(input.id) as
    | {
        id: number;
        tracked_instrument_id: number;
        amount_eur: number;
        inferred_units_delta: number | null;
        is_active: number;
        inferred_units: number | null;
        current_amount_eur: number;
        last_market_value_eur: number | null;
      }
    | undefined;

  if (!existing) {
    throw new Error("No existe el movimiento indicado.");
  }

  if (input.trackedInstrumentId !== existing.tracked_instrument_id) {
    throw new Error("Cambiar un movimiento a otro instrumento todavia no esta soportado.");
  }

  const signedAmount = input.flowType === "contribution" ? input.amountEur : -input.amountEur;
  const inferredUnitsDelta =
    liveQuote && liveQuote.currentPriceEur > 0 ? signedAmount / liveQuote.currentPriceEur : null;
  const unitsAdjustment = (inferredUnitsDelta ?? 0) - (existing.inferred_units_delta ?? 0);
  const amountAdjustment = signedAmount - existing.amount_eur;

  const tx = db.transaction(() => {
    db.prepare(
      `
        UPDATE tracked_instrument_flows
        SET
          tracked_instrument_id = @trackedInstrumentId,
          flow_date = @flowDate,
          flow_type = @flowType,
          amount_eur = @amountEur,
          inferred_units_delta = @inferredUnitsDelta
        WHERE id = @id
      `,
    ).run({
      id: input.id,
      trackedInstrumentId: input.trackedInstrumentId,
      flowDate: input.flowDate,
      flowType: input.flowType,
      amountEur: signedAmount,
      inferredUnitsDelta,
    });

    db.prepare(
      `
        UPDATE tracked_instruments
        SET
          inferred_units = CASE
            WHEN inferred_units IS NOT NULL OR @unitsAdjustment != 0 THEN COALESCE(inferred_units, 0) + @unitsAdjustment
            ELSE inferred_units
          END,
          current_amount_eur = current_amount_eur + @amountAdjustment,
          last_market_value_eur = CASE
            WHEN is_active = 1 THEN COALESCE(last_market_value_eur, current_amount_eur) + @amountAdjustment
            ELSE last_market_value_eur
          END,
          last_updated = @lastUpdated
        WHERE id = @trackedInstrumentId
      `,
    ).run({
      trackedInstrumentId: input.trackedInstrumentId,
      unitsAdjustment,
      amountAdjustment,
      lastUpdated: liveQuote?.fetchedAt ?? new Date().toISOString(),
    });
  });

  tx();

  return input.id;
}

function mapTrackedInstruments(
  rows: TrackedInstrumentRow[],
  quoteMap: Map<string, QuoteRow>,
  flowMap: Map<number, InstrumentFlowRow[]>,
) {
  const mapped = rows.map((row) => {
    const status = row.is_active === 1 ? "active" : "inactive";
    const flows = flowMap.get(row.id) ?? [];
    const futureNetFlowsEur = flows.reduce((sum, flow) => sum + flow.amount_eur, 0);
    const effectiveCurrentAmount =
      status === "active" ? row.last_market_value_eur ?? row.current_amount_eur : row.current_amount_eur;
    const basisAmountEur = row.basis_amount_eur + futureNetFlowsEur;
    const totalContributionsEur = row.estimated_contributions_eur + futureNetFlowsEur;
    const plEur = effectiveCurrentAmount - basisAmountEur;
    const plPercent = basisAmountEur > 0 ? (plEur / basisAmountEur) * 100 : 0;
    const quote = quoteMap.get(row.symbol);

    return {
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      assetType: row.asset_type,
      status,
      startDate: row.start_date,
      startDatePrecision: row.start_date_precision,
      endDate: row.end_date,
      initialAmountEur: row.initial_amount_eur,
      currentAmountEur: effectiveCurrentAmount,
      basisAmountEur,
      historicalEstimatedContributionsEur: row.estimated_contributions_eur,
      futureNetFlowsEur,
      totalContributionsEur,
      plEur,
      plPercent,
      weight: 0,
      totalReturnPercent: row.total_return_percent,
      returnPrecision: row.return_precision,
      lastUpdated: row.last_updated,
      dayChangePercent: quote?.change_percent ?? null,
    } satisfies Holding;
  });

  const totalValue = mapped.reduce((sum, item) => sum + item.currentAmountEur, 0);

  return mapped.map((item) => ({
    ...item,
    weight: totalValue > 0 ? (item.currentAmountEur / totalValue) * 100 : 0,
  }));
}

export function getPortfolioSnapshotMetrics() {
  const tracked = getTrackedInstrumentRows();
  const quotes = getQuotes();
  const flows = getInstrumentFlows();
  const flowMap = new Map<number, InstrumentFlowRow[]>();
  for (const flow of flows) {
    const existing = flowMap.get(flow.tracked_instrument_id) ?? [];
    existing.push(flow);
    flowMap.set(flow.tracked_instrument_id, existing);
  }
  const trackedHoldings = mapTrackedInstruments(tracked, new Map(quotes.map((quote) => [quote.symbol, quote])), flowMap);
  const settings = getAppSettings();
  const totalValueEur = trackedHoldings.reduce((sum, item) => sum + item.currentAmountEur, 0);
  const totalCostEur = trackedHoldings.reduce((sum, item) => sum + item.basisAmountEur, 0);
  const totalPlEur = totalValueEur - totalCostEur;
  const benchmarkQuote = quotes.find((quote) => quote.symbol === settings.benchmarkSymbol);

  return {
    totalValueEur,
    totalCostEur,
    totalPlEur,
    benchmarkSymbol: settings.benchmarkSymbol,
    benchmarkPriceEur: benchmarkQuote?.price ?? null,
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const quotes = getQuotes();
  const quoteMap = new Map(quotes.map((quote) => [quote.symbol, quote]));
  const settings = getAppSettings();
  const trackedRows = getTrackedInstrumentRows();
  const flowRows = getInstrumentFlows();
  const flowMap = new Map<number, InstrumentFlowRow[]>();

  for (const flow of flowRows) {
    const existing = flowMap.get(flow.tracked_instrument_id) ?? [];
    existing.push(flow);
    flowMap.set(flow.tracked_instrument_id, existing);
  }

  const holdings = mapTrackedInstruments(trackedRows, quoteMap, flowMap).sort(
    (left, right) => right.currentAmountEur - left.currentAmountEur,
  );
  const totalValueEur = holdings.reduce((sum, item) => sum + item.currentAmountEur, 0);
  const totalCostEur = holdings.reduce((sum, item) => sum + item.basisAmountEur, 0);
  const totalPlEur = totalValueEur - totalCostEur;
  const totalPlPercent = totalCostEur > 0 ? (totalPlEur / totalCostEur) * 100 : 0;
  const totalFutureFlowsEur = holdings.reduce((sum, item) => sum + item.futureNetFlowsEur, 0);
  const lastUpdated =
    holdings
      .filter((item) => item.lastUpdated)
      .map((item) => item.lastUpdated as string)
      .sort()
      .at(-1) ?? latestIso(quotes);
  const lastUpdatedHuman = lastUpdated
    ? formatDistanceToNowStrict(new Date(lastUpdated), { addSuffix: true })
    : "sin refresco";

  const snapshots = getSnapshots();
  const earliestStartDate = getEarliestTrackedStartDate(trackedRows);
  let benchmarkHistory: BenchmarkHistoryPoint[] = [];

  if (earliestStartDate) {
    try {
      benchmarkHistory = await getBenchmarkHistory(settings.benchmarkSymbol, earliestStartDate);
    } catch {
      benchmarkHistory = [];
    }
  }

  const snapshotPerformanceSeries = buildSnapshotPerformanceSeries(snapshots);
  const estimatedPerformanceSeries = buildEstimatedPerformanceSeries(trackedRows, flowMap, benchmarkHistory);
  const performanceSeries = estimatedPerformanceSeries.length > 0 ? estimatedPerformanceSeries : snapshotPerformanceSeries;
  const holdingPerformanceSeries = buildHoldingPerformanceSeries(trackedRows, flowMap);

  const latestPerformance = performanceSeries.at(-1) ?? null;
  const benchmarkDelta =
    latestPerformance && latestPerformance.portfolioIndex !== null && latestPerformance.benchmarkIndex !== null
      ? latestPerformance.portfolioIndex - latestPerformance.benchmarkIndex
      : null;
  const currentDate = new Date();
  const periodChange = (reference: PerformancePoint | null) => {
    const currentIndex = latestPerformance?.portfolioIndex ?? null;
    const referenceIndex = reference?.portfolioIndex ?? null;

    return currentIndex && referenceIndex ? ((currentIndex / referenceIndex) - 1) * 100 : null;
  };

  const transactions = getTransactions();

  return {
    summary: {
      totalValueEur,
      totalCostEur,
      totalPlEur,
      totalPlPercent,
      positions: holdings.length,
      activePositions: holdings.filter((item) => item.status === "active").length,
      inactivePositions: holdings.filter((item) => item.status === "inactive").length,
      totalFutureFlowsEur,
      lastUpdated,
      lastUpdatedHuman,
      benchmarkSymbol: settings.benchmarkSymbol,
      portfolioIndex: latestPerformance?.portfolioIndex ?? null,
      benchmarkIndex: latestPerformance?.benchmarkIndex ?? null,
      benchmarkDelta,
      periodReturns: {
        day: periodChange(getSeriesReferencePoint(performanceSeries, subDays(currentDate, 1))),
        week: periodChange(getSeriesReferencePoint(performanceSeries, subDays(currentDate, 7))),
        month: periodChange(getSeriesReferencePoint(performanceSeries, subDays(currentDate, 30))),
        year: periodChange(getSeriesReferencePoint(performanceSeries, subYears(currentDate, 1))),
        sinceStart: latestPerformance?.portfolioIndex !== null ? (latestPerformance?.portfolioIndex ?? 100) - 100 : null,
      },
    },
    holdings,
    allocation: holdings.map((holding) => ({
      symbol: holding.symbol,
      name: holding.name,
      value: holding.currentAmountEur,
      weight: holding.weight,
    })),
    performanceSeries,
    holdingPerformanceSeries,
    latestTransactions: [...transactions]
      .sort((left, right) => `${right.trade_date}${right.id}`.localeCompare(`${left.trade_date}${left.id}`))
      .slice(0, 8)
      .map((tx) => ({
        id: tx.id,
        symbol: tx.symbol,
        operation: tx.operation,
        quantity: tx.quantity,
        price: tx.price,
        currency: tx.currency,
        tradeDate: tx.trade_date,
      })),
    latestFlows: [...flowRows]
      .sort((left, right) => `${right.flow_date}${right.id}`.localeCompare(`${left.flow_date}${left.id}`))
      .map((flow) => {
        const instrument = trackedRows.find((row) => row.id === flow.tracked_instrument_id);
        return {
          id: flow.id,
          trackedInstrumentId: flow.tracked_instrument_id,
          symbol: instrument?.symbol ?? "--",
          name: instrument?.name ?? "--",
          flowType: flow.amount_eur >= 0 ? "contribution" : "withdrawal",
          amountEur: Math.abs(flow.amount_eur),
          flowDate: flow.flow_date,
        };
      }),
    settings: {
      baseCurrency: settings.baseCurrency,
      benchmarkSymbol: settings.benchmarkSymbol,
    },
    staleSymbols: holdings.filter((item) => item.status === "active" && !item.lastUpdated).map((item) => item.symbol),
  };
}

export async function getAssetDetail(symbol: string) {
  const dashboard = await getDashboardData();
  const holding = dashboard.holdings.find((item) => item.symbol === symbol.toUpperCase()) ?? null;
  return {
    symbol: symbol.toUpperCase(),
    holding,
    transactions: [],
  };
}
