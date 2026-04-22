import { format, formatDistanceToNowStrict, parseISO, subDays, subYears } from "date-fns";

import { getAppSettings, getDatabase } from "@/lib/db";
import type { ContributionInput, TrackedInstrumentInput, TransactionInput } from "@/lib/schemas";

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
  returnPrecision: "exact" | "estimated";
  lastUpdated: string | null;
  dayChangePercent: number | null;
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

function getReferenceValue(snapshots: SnapshotRow[], targetDate: Date) {
  const targetTime = targetDate.getTime();
  const eligible = snapshots.filter((snapshot) => new Date(snapshot.captured_at).getTime() <= targetTime);
  return eligible.at(-1)?.total_value_eur ?? null;
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

export function getDashboardData(): DashboardData {
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
  const firstPortfolioBase = snapshots.find((snapshot) => snapshot.total_value_eur > 0)?.total_value_eur ?? null;
  const firstBenchmarkBase = snapshots.find((snapshot) => (snapshot.benchmark_price_eur ?? 0) > 0)?.benchmark_price_eur ?? null;
  const performanceSeries = snapshots.map((snapshot) => ({
    date: snapshot.captured_at,
    label: format(parseISO(snapshot.captured_at), "dd MMM"),
    portfolioValue: snapshot.total_value_eur,
    totalCost: snapshot.total_cost_eur,
    portfolioIndex: firstPortfolioBase ? (snapshot.total_value_eur / firstPortfolioBase) * 100 : null,
    benchmarkIndex:
      firstBenchmarkBase && snapshot.benchmark_price_eur
        ? (snapshot.benchmark_price_eur / firstBenchmarkBase) * 100
        : null,
  }));

  const latestPerformance = performanceSeries.at(-1) ?? null;
  const benchmarkDelta =
    latestPerformance && latestPerformance.portfolioIndex !== null && latestPerformance.benchmarkIndex !== null
      ? latestPerformance.portfolioIndex - latestPerformance.benchmarkIndex
      : null;
  const currentDate = new Date();
  const periodChange = (reference: number | null) =>
    reference && reference > 0 ? ((totalValueEur - reference) / reference) * 100 : null;

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
        day: periodChange(getReferenceValue(snapshots, subDays(currentDate, 1))),
        week: periodChange(getReferenceValue(snapshots, subDays(currentDate, 7))),
        month: periodChange(getReferenceValue(snapshots, subDays(currentDate, 30))),
        year: periodChange(getReferenceValue(snapshots, subYears(currentDate, 1))),
        sinceStart: totalPlPercent,
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
      .slice(0, 8)
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

export function getAssetDetail(symbol: string) {
  const dashboard = getDashboardData();
  const holding = dashboard.holdings.find((item) => item.symbol === symbol.toUpperCase()) ?? null;
  return {
    symbol: symbol.toUpperCase(),
    holding,
    transactions: [],
  };
}
