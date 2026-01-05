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

// --- Binance US (Crypto) ---
// Vercel (US IP) friendly.

async function fetchCryptoCandles(symbol: string): Promise<Candle[]> {
    // Map format: BTC-USD -> BTCUSD
    let binanceSymbol = symbol.replace('-', '').replace('/', '').toUpperCase();

    // Binance US usually uses 'USD' as quote for fiat pairs (BTCUSD), or 'USDT' (BTCUSDT)
    // Finnhub usually uses symbol 'BINANCE:BTCUSDT'.
    // User usually types 'BTC-USD'.
    // Try BTCUSD first (USD pair).

    // Heuristic: If it contains 'USD', remove hyphen.
    // Note: Binance US supports both BTCUSD and BTCUSDT.

    try {
        const url = `https://api.binance.us/api/v3/klines?symbol=${binanceSymbol}&interval=1d&limit=60`;
        const res = await fetch(url);

        if (!res.ok) {
            // Try adding 'T' if it was USD -> USDT? Or just log failure.
            console.error(`Binance US error for ${binanceSymbol}: ${res.status}`);
            return [];
        }

        const data = await res.json();
        return data.map((d: any[]) => ({
            date: new Date(d[0]),
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5]),
        }));
    } catch (e) {
        console.error(`Binance US fetch failed for ${symbol}`, e);
        return [];
    }
}

async function fetchCryptoQuote(symbol: string): Promise<QuoteData | null> {
    let binanceSymbol = symbol.replace('-', '').replace('/', '').toUpperCase();

    try {
        const url = `https://api.binance.us/api/v3/ticker/24hr?symbol=${binanceSymbol}`;
        const res = await fetch(url);
        if (!res.ok) {
            // Try fetching error message
            try {
                const err = await res.json();
                console.error(`Binance US error for ${binanceSymbol}:`, err);
            } catch { }

            // Allow Fallback to undefined/null to Trigger 'Cached Data' UI
            return null;
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
        console.error(`Binance US quote failed for ${symbol}`, e);
        return null;
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
        return fetchCryptoCandles(symbol);
    } else {
        return fetchFinnhubCandles(symbol);
    }
};

export const fetchMixedQuote = async (symbol: string, type: 'stock' | 'crypto'): Promise<QuoteData | null> => {
    if (type === 'crypto') {
        return fetchCryptoQuote(symbol);
    } else {
        return fetchFinnhubQuote(symbol);
    }
};
