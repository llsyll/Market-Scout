import { Candle } from './yahoo';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

// Helper to sleep for rate limiting
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Types ---

export interface QuoteData {
    symbol: string;
    regularMarketPrice?: number;
    regularMarketChange?: number;
    regularMarketChangePercent?: number;
    shortName?: string;
}

// --- Binance (Crypto) ---

async function fetchBinanceCandles(symbol: string): Promise<Candle[]> {
    // Map format: BTC-USD -> BTCUSDT
    const pair = symbol.replace('-', '').replace('/', '').toUpperCase();
    // Default to USDT if not specified? Usually user enters BTC-USD.
    // If user enters just "BTC", we might need to guess, but assuming BTC-USD format from yahoo.
    // Let's assume standard yahoo crypto format is SYMBOL-CURRENCY.
    // If it's just "BTC", we might fail. But let's try to handle standard cases.
    let binanceSymbol = pair;
    if (symbol.includes('-')) {
        const [base, quote] = symbol.split('-');
        binanceSymbol = `${base}${quote}`;
    }

    try {
        // Interval 1d, limit 60
        const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=1d&limit=60`;
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`Binance error for ${binanceSymbol}: ${res.status} ${res.statusText}`);
            return [];
        }
        const data = await res.json();
        // Binance response: [ [ openTime, open, high, low, close, volume, ... ], ... ]
        return data.map((d: any[]) => ({
            date: new Date(d[0]),
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5]),
        }));
    } catch (e) {
        console.error(`Binance fetch failed for ${symbol}`, e);
        return [];
    }
}

async function fetchBinanceQuote(symbol: string): Promise<QuoteData | null> {
    let binanceSymbol = symbol.replace('-', '').replace('/', '').toUpperCase();
    if (symbol.includes('-')) {
        const [base, quote] = symbol.split('-');
        binanceSymbol = `${base}${quote}`;
    }

    try {
        // 24hr ticker for change stats
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`;
        const res = await fetch(url);
        if (!res.ok) {
            if (res.status === 451 || res.status === 403) {
                throw new Error("Binance Blocked (Region)");
            }
            throw new Error(`Binance API Error: ${res.status}`);
        }
        const data = await res.json();

        return {
            symbol: symbol,
            regularMarketPrice: parseFloat(data.lastPrice),
            regularMarketChange: parseFloat(data.priceChange),
            regularMarketChangePercent: parseFloat(data.priceChangePercent),
            shortName: symbol
        };
    } catch (e) {
        console.error(`Binance quote failed for ${symbol}`, e);
        throw e;
    }
}

// --- Finnhub (Stocks) ---

async function fetchFinnhubCandles(symbol: string): Promise<Candle[]> {
    if (!FINNHUB_API_KEY) {
        console.warn("FINNHUB_API_KEY missing");
        return [];
    }

    // Finnhub logic: needs timestamp. 
    // resolution 'D'
    const to = Math.floor(Date.now() / 1000);
    const from = to - (60 * 24 * 60 * 60); // 60 days ago

    try {
        const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`Finnhub error for ${symbol}: ${res.status}`);
            return [];
        }
        const data = await res.json();

        if (data.s !== 'ok') {
            console.error(`Finnhub no data for ${symbol}:`, data);
            return [];
        }

        // data: { c: [], h: [], l: [], o: [], t: [], v: [] }
        const candles: Candle[] = [];
        for (let i = 0; i < data.t.length; i++) {
            candles.push({
                date: new Date(data.t[i] * 1000),
                open: data.o[i],
                high: data.h[i],
                low: data.l[i],
                close: data.c[i],
                volume: data.v[i]
            });
        }
        return candles;
    } catch (e) {
        console.error(`Finnhub fetch failed for ${symbol}`, e);
        return [];
    }
}

async function fetchFinnhubQuote(symbol: string): Promise<QuoteData | null> {
    if (!FINNHUB_API_KEY) {
        throw new Error("Missing FINNHUB_API_KEY");
    }
    try {
        const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Finnhub API Error: ${res.status}`);
        }
        const data = await res.json();

        // Finnhub quote: { c: current, d: change, dp: percent, ... }
        // Check if data is valid (Finnhub returns 0s for invalid symbols sometimes)
        if (data.c === 0 && data.h === 0 && data.l === 0) {
            // Maybe invalid symbol or no data
        }

        return {
            symbol: symbol,
            regularMarketPrice: data.c,
            regularMarketChange: data.d,
            regularMarketChangePercent: data.dp,
            shortName: symbol
        };
    } catch (e) {
        console.error(`Finnhub quote failed for ${symbol}`, e);
        throw e; // Re-throw to be caught by route
    }
}

// --- Unified Provider ---

export const fetchMixedCandles = async (symbol: string, type: 'stock' | 'crypto'): Promise<Candle[]> => {
    if (type === 'crypto') {
        return fetchBinanceCandles(symbol);
    } else {
        return fetchFinnhubCandles(symbol);
    }
};

export const fetchMixedQuote = async (symbol: string, type: 'stock' | 'crypto'): Promise<QuoteData | null> => {
    if (type === 'crypto') {
        return fetchBinanceQuote(symbol);
    } else {
        return fetchFinnhubQuote(symbol);
    }
};
