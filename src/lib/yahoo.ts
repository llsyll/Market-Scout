import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

export interface Candle {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface QuoteData {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  shortName?: string;
}

export const fetchStockData = async (symbol: string, period = 60): Promise<Candle[]> => {
  // Suppress "notice" warnings that clutter logs
  // yahooFinance.suppressNotices(['yahooSurvey', 'ripHistorical']);

  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (period * 2));

    const queryOptions = {
      period1: start,
      period2: end,
      interval: '1d' as const,
    };

    // historical is deprecated but often mapped to chart. 
    // If it fails completely we can switch to chart.
    const result = await yahooFinance.historical(symbol, queryOptions);

    return result.map((item) => ({
      date: item.date,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }));
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error);
    return [];
  }
};

export const getQuotes = async (symbols: string[]): Promise<QuoteData[]> => {
  if (symbols.length === 0) return [];
  try {
    const results = await yahooFinance.quote(symbols);
    if (!Array.isArray(results)) {
      return [results]; // Single result case
    }
    return results.map(q => ({
      symbol: q.symbol,
      regularMarketPrice: q.regularMarketPrice,
      regularMarketChange: q.regularMarketChange,
      regularMarketChangePercent: q.regularMarketChangePercent,
      shortName: q.shortName
    }));
  } catch (error) {
    console.error(`Error fetching quotes:`, error);
    return [];
  }
}

export const searchSymbol = async (query: string) => {
  try {
    const result = await yahooFinance.search(query);
    return result.quotes.filter((q: any) => q.isYahooFinance); // Filter relevant ones
  } catch (error) {
    console.error("Search error:", error);
    return [];
  }
};
