import { fetchStockData, getQuotes, Candle, QuoteData } from './yahoo';

// --- Binance Vision (Public Data) ---
// Uses the same API structure as Binance.com but is less restricted
const BINANCE_API_BASE = 'https://data-api.binance.vision/api/v3';

async function fetchBinanceCandles(symbol: string): Promise<Candle[]> {
    // Map format: BTC-USD -> BTCUSDT
    let binanceSymbol = symbol.replace('-', '').replace('/', '').toUpperCase();
    if (symbol.includes('-')) {
        const [base, quote] = symbol.split('-');
        binanceSymbol = `${base}${quote}`;
    }

    try {
        const url = `${BINANCE_API_BASE}/klines?symbol=${binanceSymbol}&interval=1d&limit=60`;
        const res = await fetch(url);
        if (!res.ok) {
            // Try fallback to Binance US if Vision fails (sometimes happens for specific pairs)
            const usUrl = `https://api.binance.us/api/v3/klines?symbol=${binanceSymbol}&interval=1d&limit=60`;
            const usRes = await fetch(usUrl);
            if (!usRes.ok) {
                console.error(`Binance Vision & US error for ${binanceSymbol}: ${res.status}`);
                return [];
            }
            const data = await usRes.json();
            return mapBinanceCandles(data);
        }
        const data = await res.json();
        return mapBinanceCandles(data);
    } catch (e) {
        console.error(`Binance fetch failed for ${symbol}`, e);
        return [];
    }
}

function mapBinanceCandles(data: any[]): Candle[] {
    return data.map((d: any[]) => ({
        date: new Date(d[0]),
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5]),
    }));
}

async function fetchBinanceQuote(symbol: string): Promise<QuoteData | null> {
    let binanceSymbol = symbol.replace('-', '').replace('/', '').toUpperCase();
    if (symbol.includes('-')) {
        const [base, quote] = symbol.split('-');
        binanceSymbol = `${base}${quote}`;
    }

    try {
        const url = `${BINANCE_API_BASE}/ticker/24hr?symbol=${binanceSymbol}`;
        const res = await fetch(url);
        let data;

        if (!res.ok) {
            // Try fallback to Binance US
            const usUrl = `https://api.binance.us/api/v3/ticker/24hr?symbol=${binanceSymbol}`;
            const usRes = await fetch(usUrl);
            if (!usRes.ok) return null;
            data = await usRes.json();
        } else {
            data = await res.json();
        }

        return {
            symbol: symbol,
            regularMarketPrice: parseFloat(data.lastPrice),
            regularMarketChange: parseFloat(data.priceChange),
            regularMarketChangePercent: parseFloat(data.priceChangePercent),
            shortName: symbol
        };
    } catch (e) {
        console.error(`Binance quote failed for ${symbol}`, e);
        return null;
    }
}

// --- Unified Provider ---

export const fetchMixedCandles = async (symbol: string, type: 'stock' | 'crypto'): Promise<Candle[]> => {
    if (type === 'crypto') {
        return fetchBinanceCandles(symbol);
    }

    // Yahoo Finance handles stocks
    return await fetchStockData(symbol);
};

export const fetchMixedQuote = async (symbol: string, type: 'stock' | 'crypto'): Promise<QuoteData | null> => {
    if (type === 'crypto') {
        return fetchBinanceQuote(symbol);
    }

    // Stocks via Yahoo
    try {
        const quotes = await getQuotes([symbol]);
        if (quotes && quotes.length > 0) {
            return quotes[0];
        }
        return null;
    } catch (error) {
        console.error(`Error fetching quote for ${symbol}:`, error);
        return null;
    }
};
