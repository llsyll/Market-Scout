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
  // @ts-ignore
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

// Yahoo search is blocked on Vercel (429/403). Use Finnhub.
export const searchSymbol = async (query: string) => {
  const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
  if (!FINNHUB_API_KEY) return [];

  try {
    const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${FINNHUB_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    // Finnhub response: { count: 123, result: [ { description, displaySymbol, symbol, type }, ... ] }

    return data.result.slice(0, 15).map((item: any) => {
      // Finnhub symbols often look like "BINANCE:BTCUSDT". 
      // We want to display "BTCUSDT" but maybe keep original valid?
      // Actually, let's just use the displaySymbol if available or strip the prefix.
      // displaySymbol is usually shorter.
      return {
        symbol: item.displaySymbol || item.symbol,
        shortname: item.description,
        quoteType: item.type ? item.type.toUpperCase() : 'UNKNOWN',
        exchange: item.displaySymbol?.includes(':') ? item.displaySymbol.split(':')[0] : 'Unknown'
      };
    });
  } catch (error) {
    console.error("Search error:", error);
    return [];
  }
};
```
