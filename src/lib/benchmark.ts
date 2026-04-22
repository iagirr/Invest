import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

type ChartQuoteLike = {
  date: Date;
  close: number | null;
  adjclose?: number | null;
};

export type BenchmarkHistoryPoint = {
  date: Date;
  close: number;
};

export async function getBenchmarkHistory(symbol: string, period1: Date): Promise<BenchmarkHistoryPoint[]> {
  const result = await yahooFinance.chart(symbol, {
    period1,
    period2: new Date(),
    interval: "1d",
  });

  return (result.quotes as ChartQuoteLike[])
    .map((quote) => ({
      date: quote.date,
      close: quote.adjclose ?? quote.close ?? null,
    }))
    .filter((quote): quote is BenchmarkHistoryPoint => quote.close !== null && quote.close > 0)
    .sort((left, right) => left.date.getTime() - right.date.getTime());
}
