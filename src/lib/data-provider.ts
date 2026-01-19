import { fetchStockData, getQuotes, searchSymbol as searchYahoo, Candle, QuoteData } from './yahoo';

// --- Configuration ---
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

// Common Headers to mimic a browser and avoid basic bot detection
const FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
};

// --- CoinGecko (Fallback for Crypto) ---
async function fetchCoinGeckoQuote(symbol: string): Promise<QuoteData | null> {
    // Map BTC-USD to bitcoin, SOL-USD to solana
    const idMap: Record<string, string> = {
        'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'DOGE': 'dogecoin', 'BONK': 'bonk',
        'ADA': 'cardano', 'XRP': 'ripple', 'DOT': 'polkadot', 'AVAX': 'avalanche-2',
        'LINK': 'chainlink', 'MATIC': 'matic-network', 'SHIB': 'shiba-inu'
    };

    // Parse base symbol
    let base = symbol.toUpperCase();
    if (symbol.includes('-')) base = symbol.split('-')[0];
    if (symbol.includes('/')) base = symbol.split('/')[0];
    // Specific fix for "BONKUSDT" -> "BONK"
    if (base.endsWith('USDT')) base = base.replace('USDT', '');
    if (base.endsWith('USD')) base = base.replace('USD', '');

    const id = idMap[base] || base.toLowerCase();

    try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`;
        const res = await fetch(url, { headers: FETCH_HEADERS });
        if (!res.ok) return null;
        const data = await res.json();
        const item = data[id];
        if (!item) return null;

        return {
            symbol: symbol,
            regularMarketPrice: item.usd,
            regularMarketChange: (item.usd * (item.usd_24h_change / 100)), // Approximate change value
            regularMarketChangePercent: item.usd_24h_change,
            shortName: symbol
        };
    } catch (e) {
        console.error(`CoinGecko fallback failed for ${symbol}`, e);
        return null;
    }
}

export async function searchCoinGecko(query: string) {
    try {
        const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`;
        const res = await fetch(url, { headers: FETCH_HEADERS });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.coins || []).slice(0, 5).map((coin: any) => ({
            symbol: `${coin.symbol.toUpperCase()}-USD`, // Normalize to typical format
            shortname: coin.name,
            quoteType: 'CRYPTOCURRENCY',
            exchange: 'CoinGecko',
            source: 'CoinGecko'
        }));
    } catch (e) {
        console.error("CoinGecko search failed", e);
        return [];
    }
}

// --- Binance Vision (Public Data) ---
// Uses the same API structure as Binance.com but is less restricted
const BINANCE_API_BASE = 'https://data-api.binance.vision/api/v3';

async function fetchBinanceCandles(symbol: string): Promise<Candle[]> {
    let binanceSymbol = symbol.replace('-', '').replace('/', '').toUpperCase();
    if (symbol.includes('-')) {
        const [base, quote] = symbol.split('-');
        binanceSymbol = `${base}${quote}`;
    }

    try {
        const url = `${BINANCE_API_BASE}/klines?symbol=${binanceSymbol}&interval=1d&limit=60`;
        const res = await fetch(url, { headers: FETCH_HEADERS });
        if (!res.ok) {
            // Fallback: Binance US
            const usUrl = `https://api.binance.us/api/v3/klines?symbol=${binanceSymbol}&interval=1d&limit=60`;
            const usRes = await fetch(usUrl, { headers: FETCH_HEADERS });
            if (!usRes.ok) return [];
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
    // Handle specific formats like "BONKUSDT" directly if passed without separator
    if (symbol.includes('-')) {
        const [base, quote] = symbol.split('-');
        binanceSymbol = `${base}${quote}`;
    }

    try {
        const url = `${BINANCE_API_BASE}/ticker/24hr?symbol=${binanceSymbol}`;
        const res = await fetch(url, { headers: FETCH_HEADERS });
        if (res.ok) {
            const data = await res.json();
            return mapBinanceQuote(data, symbol);
        }

        // Fallback: Binance US
        const usUrl = `https://api.binance.us/api/v3/ticker/24hr?symbol=${binanceSymbol}`;
        const usRes = await fetch(usUrl, { headers: FETCH_HEADERS });
        if (usRes.ok) {
            const data = await usRes.json();
            return mapBinanceQuote(data, symbol);
        }
        return null;
    } catch (e) {
        console.error(`Binance quote failed for ${symbol}`, e);
        return null;
    }
}

function mapBinanceQuote(data: any, symbol: string): QuoteData {
    return {
        symbol: symbol,
        regularMarketPrice: parseFloat(data.lastPrice),
        regularMarketChange: parseFloat(data.priceChange),
        regularMarketChangePercent: parseFloat(data.priceChangePercent),
        shortName: symbol
    };
}

// --- Finnhub (Fallback for Stocks) ---

async function fetchFinnhubCandles(symbol: string): Promise<Candle[]> {
    if (!FINNHUB_API_KEY) return [];

    const to = Math.floor(Date.now() / 1000);
    const from = to - (60 * 24 * 60 * 60);

    try {
        const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;
        const res = await fetch(url, { headers: FETCH_HEADERS });
        if (!res.ok) return [];
        const data = await res.json();
        if (data.s !== 'ok') return [];

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
        console.error(`Finnhub candle fetch failed for ${symbol}`, e);
        return [];
    }
}

async function fetchFinnhubQuote(symbol: string): Promise<QuoteData | null> {
    if (!FINNHUB_API_KEY) return null;
    try {
        const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
        const res = await fetch(url, { headers: FETCH_HEADERS });
        if (!res.ok) return null;
        const data = await res.json();

        return {
            symbol: symbol,
            regularMarketPrice: data.c,
            regularMarketChange: data.d,
            regularMarketChangePercent: data.dp,
            shortName: symbol
        };
    } catch (e) {
        console.error(`Finnhub quote failed for ${symbol}`, e);
        return null;
    }
}

export async function searchFinnhub(query: string) {
    if (!FINNHUB_API_KEY) return [];
    try {
        const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${FINNHUB_API_KEY}`;
        const res = await fetch(url, { headers: FETCH_HEADERS });
        if (!res.ok) return [];
        const data = await res.json();
        return data.result || [];
    } catch (e) {
        console.error("Finnhub search failed", e);
        return [];
    }
}

// --- Unified Provider ---

export const fetchMixedCandles = async (symbol: string, type: 'stock' | 'crypto'): Promise<Candle[]> => {
    if (type === 'crypto') {
        const candles = await fetchBinanceCandles(symbol);
        // If Binance blocked/failed, could technically try others but candle data is heavy
        return candles;
    }
    // Stocks: Try Yahoo first, then Finnhub
    try {
        const candles = await fetchStockData(symbol);
        if (candles.length > 0) return candles;
        throw new Error("Yahoo/Empty");
    } catch (e) {
        return await fetchFinnhubCandles(symbol);
    }
};

export const fetchMixedQuote = async (symbol: string, type: 'stock' | 'crypto'): Promise<QuoteData | null> => {
    if (type === 'crypto') {
        // Priority 1: CoinGecko (Likely to work on Vercel)
        const cgQuote = await fetchCoinGeckoQuote(symbol);
        if (cgQuote) return cgQuote;

        // Priority 2: Binance (Likely blocked, but good backup)
        console.log(`CoinGecko failed for ${symbol}, trying Binance...`);
        return await fetchBinanceQuote(symbol);
    }

    // Stocks: Try Finnhub first (Key required), then Yahoo
    try {
        const fhQuote = await fetchFinnhubQuote(symbol);
        if (fhQuote && fhQuote.regularMarketPrice) return fhQuote;
        // If Finnhub returns empty or fails, throw to try Yahoo
        if (!fhQuote) throw new Error("Finnhub/Empty");
    } catch (e) {
        console.log(`Finnhub failed/missing for ${symbol}, trying Yahoo...`);
    }

    // Fallback: Yahoo
    try {
        const quotes = await getQuotes([symbol]);
        if (quotes && quotes.length > 0) return quotes[0];
        return null;
    } catch (error) {
        console.error(`All providers failed for ${symbol}`);
        return null;
    }
};

export const unifiedSearch = async (query: string) => {
    const results: any[] = [];
    const isCryptoLike = query.toUpperCase().includes('USD') ||
        ['BTC', 'ETH', 'SOL', 'DOGE', 'BONK', 'PEPE'].some(c => query.toUpperCase().includes(c));

    // 1. If Crypto-like, try CoinGecko FIRST
    if (isCryptoLike) {
        try {
            const cgResults = await searchCoinGecko(query);
            results.push(...cgResults);
        } catch (e) { }
    }

    // 2. Try Yahoo (Standard for stocks)
    try {
        const yahooResults = await searchYahoo(query);
        if (yahooResults && yahooResults.length > 0) {
            yahooResults.forEach((item: any) => {
                // Avoid duplicates if we already found it via CoinGecko
                if (!results.find(r => r.symbol === item.symbol)) {
                    results.push({
                        symbol: item.symbol,
                        shortname: item.shortname || item.longname || item.symbol,
                        quoteType: item.quoteType,
                        exchange: item.exchange,
                        source: 'Yahoo'
                    });
                }
            });
        }
    } catch (e) { }

    // 3. If not crypto-like, try CoinGecko now (in case it was a crypto name we didn't recognize)
    if (!isCryptoLike && results.length < 3) {
        try {
            const cgResults = await searchCoinGecko(query);
            // Filter duplicates
            cgResults.forEach((item: any) => {
                if (!results.find(r => r.symbol === item.symbol)) results.push(item);
            });
        } catch (e) { }
    }

    // 4. Fallback to Finnhub
    if (results.length === 0) {
        try {
            const fhResults = await searchFinnhub(query);
            fhResults.forEach((item: any) => {
                if (!results.find(r => r.symbol === item.symbol)) {
                    results.push({
                        symbol: item.symbol,
                        shortname: item.description,
                        quoteType: item.type,
                        exchange: item.displaySymbol ? item.displaySymbol.split(':')[0] : '',
                        source: 'Finnhub'
                    });
                }
            });
        } catch (e) { }
    }

    return results;
};
