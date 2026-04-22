import YahooFinance from "yahoo-finance2";

import { getAppSettings, getDatabase } from "@/lib/db";
import { getPortfolioSnapshotMetrics } from "@/lib/portfolio";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

type QuoteLike = {
  shortName?: string | null;
  longName?: string | null;
  currency?: string | null;
  regularMarketPrice?: number | null;
  regularMarketPreviousClose?: number | null;
  regularMarketChangePercent?: number | null;
  fullExchangeName?: string | null;
  exchange?: string | null;
};

type SearchQuoteLike = {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchDisp?: string;
  exchange?: string;
  quoteType?: string;
  isYahooFinance?: boolean;
};

export type AssetSearchResult = {
  symbol: string;
  name: string;
  assetType: "stock" | "etf" | "fund";
  exchange: string;
};

export type LiveMarketQuote = {
  symbol: string;
  shortName: string;
  currency: string;
  price: number;
  previousClose: number | null;
  changePercent: number | null;
  exchangeName: string | null;
  fxRateToEur: number;
  priceEur: number;
};

async function loadQuote(symbol: string) {
  const quote = (await yahooFinance.quote(symbol)) as QuoteLike;

  if (!quote.regularMarketPrice || !quote.currency) {
    throw new Error(`No hay cotizacion utilizable para ${symbol}`);
  }

  return {
    symbol,
    shortName: quote.shortName ?? quote.longName ?? symbol,
    currency: quote.currency,
    price: quote.regularMarketPrice,
    previousClose: quote.regularMarketPreviousClose ?? null,
    changePercent: quote.regularMarketChangePercent ?? null,
    exchangeName: quote.fullExchangeName ?? quote.exchange ?? null,
  };
}

export async function loadFxRate(currency: string) {
  if (currency === "EUR") {
    return 1;
  }

  const pair = `${currency}EUR=X`;
  const quote = (await yahooFinance.quote(pair)) as QuoteLike;

  if (!quote.regularMarketPrice) {
    throw new Error(`No hay cambio utilizable para ${pair}`);
  }

  return quote.regularMarketPrice;
}

export async function getLiveMarketQuote(symbol: string): Promise<LiveMarketQuote> {
  const quote = await loadQuote(symbol);
  const fxRateToEur = await loadFxRate(quote.currency);

  return {
    ...quote,
    fxRateToEur,
    priceEur: quote.price * fxRateToEur,
  };
}

export async function searchAssets(query: string) {
  if (!query.trim()) {
    return [];
  }

  const response = await yahooFinance.search(query, {
    quotesCount: 8,
    newsCount: 0,
    enableFuzzyQuery: true,
  });

  const unique = new Set<string>();

  return (response.quotes as SearchQuoteLike[])
    .filter((item) => item.isYahooFinance && item.symbol)
    .filter((item) => item.quoteType === "EQUITY" || item.quoteType === "ETF" || item.quoteType === "MUTUALFUND")
    .map((item) => ({
      symbol: item.symbol as string,
      name: item.longname ?? item.shortname ?? (item.symbol as string),
      assetType: item.quoteType === "ETF" ? "etf" : item.quoteType === "MUTUALFUND" ? "fund" : "stock",
      exchange: item.exchDisp ?? item.exchange ?? "--",
    }))
    .filter((item) => {
      if (unique.has(item.symbol)) {
        return false;
      }
      unique.add(item.symbol);
      return true;
    });
}

export async function refreshMarketData() {
  const db = getDatabase();
  const settings = getAppSettings();
  const trackedSymbols = db
    .prepare("SELECT DISTINCT symbol FROM tracked_instruments WHERE is_active = 1 ORDER BY symbol ASC")
    .all()
    .map((row) => row as { symbol: string })
    .map((row) => row.symbol);
  const transactionSymbols = db
    .prepare("SELECT DISTINCT symbol FROM transactions ORDER BY symbol ASC")
    .all()
    .map((row) => row as { symbol: string })
    .map((row) => row.symbol);
  const symbols = Array.from(new Set([...trackedSymbols, ...transactionSymbols, settings.benchmarkSymbol])).filter(Boolean);

  const successes: Array<{
    symbol: string;
    shortName: string;
    currency: string;
    price: number;
    previousClose: number | null;
    changePercent: number | null;
    exchangeName: string | null;
  }> = [];
  const failures: string[] = [];
  const fxRates = new Map<string, number>([["EUR", 1]]);

  for (const symbol of symbols) {
    try {
      successes.push(await loadQuote(symbol));
    } catch {
      failures.push(symbol);
    }
  }

  const currencies = Array.from(
    new Set(successes.map((quote) => quote.currency).filter((currency) => currency !== "EUR")),
  );

  for (const currency of currencies) {
    try {
      fxRates.set(currency, await loadFxRate(currency));
    } catch {
      failures.push(`${currency}->EUR`);
    }
  }

  const timestamp = new Date().toISOString();

  const transaction = db.transaction(() => {
    for (const quote of successes) {
      db.prepare(
        `
          INSERT INTO market_quotes (
            symbol, short_name, currency, price, previous_close, change_percent, exchange_name, fetched_at
          ) VALUES (
            @symbol, @shortName, @currency, @price, @previousClose, @changePercent, @exchangeName, @fetchedAt
          )
          ON CONFLICT(symbol) DO UPDATE SET
            short_name = excluded.short_name,
            currency = excluded.currency,
            price = excluded.price,
            previous_close = excluded.previous_close,
            change_percent = excluded.change_percent,
            exchange_name = excluded.exchange_name,
            fetched_at = excluded.fetched_at
        `,
      ).run({
        ...quote,
        fetchedAt: timestamp,
      });

      const priceEur = quote.price * (fxRates.get(quote.currency) ?? 1);

      db.prepare(
        `
          UPDATE tracked_instruments
          SET
            last_market_value_eur = CASE
              WHEN inferred_units IS NOT NULL THEN inferred_units * @priceEur
              ELSE last_market_value_eur
            END,
            last_price_eur = @priceEur,
            last_updated = @lastUpdated
          WHERE symbol = @symbol AND is_active = 1
        `,
      ).run({
        symbol: quote.symbol,
        priceEur,
        lastUpdated: timestamp,
      });
    }

    for (const [currency, rateToEur] of fxRates.entries()) {
      db.prepare(
        `
          INSERT INTO fx_rates (currency, rate_to_eur, fetched_at)
          VALUES (@currency, @rateToEur, @fetchedAt)
          ON CONFLICT(currency) DO UPDATE SET
            rate_to_eur = excluded.rate_to_eur,
            fetched_at = excluded.fetched_at
        `,
      ).run({
        currency,
        rateToEur,
        fetchedAt: timestamp,
      });
    }

    const snapshot = getPortfolioSnapshotMetrics();
    db.prepare(
      `
        INSERT INTO portfolio_snapshots (
          captured_at, total_value_eur, total_cost_eur, total_pl_eur, benchmark_symbol, benchmark_price_eur
        ) VALUES (
          @capturedAt, @totalValueEur, @totalCostEur, @totalPlEur, @benchmarkSymbol, @benchmarkPriceEur
        )
      `,
    ).run({
      capturedAt: timestamp,
      ...snapshot,
    });
  });

  transaction();

  return {
    requestedSymbols: symbols.length,
    updatedSymbols: successes.length,
    failedSymbols: failures,
    lastUpdated: timestamp,
  };
}
