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

// --- CryptoCompare (Crypto) ---
// Docs: https://min-api.cryptocompare.com/documentation

async function fetchCryptoCandles(symbol: string): Promise<Candle[]> {
    // Map format: BTC-USD -> BTC
    let fsym = symbol.toUpperCase();
    if (symbol.includes('-')) {
        fsym = symbol.split('-')[0];
    }
    // Remove slash if exists
    fsym = fsym.replace('/', '');

    try {
        // limit 60 days
        const url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${fsym}&tsym=USD&limit=60`;
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`CryptoCompare error for ${symbol}: ${res.status}`);
            return [];
        }
        const json = await res.json();

        if (json.Response === 'Error') {
            console.error(`CryptoCompare API error for ${symbol}: ${json.Message}`);
            return [];
        }

        const data = json.Data.Data; // yes, Data.Data
        // Data format: { time, high, low, open, volumefrom, volumeto, close, ... }
        // time is unix timestamp in seconds

        return data.map((d: any) => ({
            date: new Date(d.time * 1000),
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            volume: d.volumeto, // Use volume in quote currency (USD) or base? usually volume is base. volumefrom is base.
        }));
    } catch (e) {
        console.error(`CryptoCompare fetch failed for ${symbol}`, e);
        return [];
    }
}

async function fetchCryptoQuote(symbol: string): Promise<QuoteData | null> {
    let fsym = symbol.toUpperCase();
    if (symbol.includes('-')) {
        fsym = symbol.split('-')[0];
    }
    fsym = fsym.replace('/', '');

    try {
        // multi price endpoint serves as a quote
        // or generate from latest candle? Candle might be delayed.
        // Let's use pricemultifull for 24h change
        const url = `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${fsym}&tsyms=USD`;
        const res = await fetch(url);
        if (!res.ok) return null;

        const json = await res.json();
        if (json.Response === 'Error') return null;

        const data = json.RAW?.[fsym]?.USD;
        if (!data) return null;

        return {
            symbol: symbol,
            regularMarketPrice: data.PRICE,
            regularMarketChange: data.CHANGE24HOUR,
            regularMarketChangePercent: data.CHANGEPCT24HOUR,
            shortName: symbol
        };
    } catch (e) {
        console.error(`CryptoCompare quote failed for ${symbol}`, e);
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
