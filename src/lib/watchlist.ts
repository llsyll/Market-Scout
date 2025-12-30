import fs from 'fs';
import path from 'path';
import { createClient } from 'redis';

// Persistence Strategy:
// 1. Redis (REDIS_URL) - Best for production
// 2. Global Memory - Good for warm lambdas
// 3. /tmp File - Backup
// 4. Local File - Dev

const IS_VERCEL = process.env.VERCEL === '1';
const REDIS_URL = process.env.REDIS_URL;

// Redis Client Singleton
let redisClient: ReturnType<typeof createClient> | null = null;

const getRedisClient = async () => {
    if (!REDIS_URL) return null;
    if (!redisClient) {
        redisClient = createClient({ url: REDIS_URL });
        redisClient.on('error', (err) => console.error('Redis Client Error', err));
        await redisClient.connect();
    }
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
    return redisClient;
};

// Local dev path or /tmp for Vercel
const DATA_FILE = IS_VERCEL
    ? path.join('/tmp', 'watchlist.json')
    : path.join(process.cwd(), 'data', 'watchlist.json');

// Global cache
declare global {
    var watchlistCache: WatchlistItem[] | undefined;
}

export interface WatchlistItem {
    symbol: string;
    type: 'stock' | 'crypto';
    indicators: {
        ma10: boolean;
        ma14: boolean;
        macd: boolean;
        kdj: boolean;
    };
}

const DEFAULT_WATCHLIST: WatchlistItem[] = [
    { symbol: 'AAPL', type: 'stock', indicators: { ma10: true, ma14: false, macd: true, kdj: true } },
    { symbol: 'BTC-USD', type: 'crypto', indicators: { ma10: true, ma14: false, macd: true, kdj: true } },
];

const ensureDataDir = () => {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
        } catch (e) {
            console.error("Failed to create dir", e);
        }
    }
};

export const getWatchlist = async (): Promise<WatchlistItem[]> => {
    // 1. Try Redis
    if (REDIS_URL) {
        try {
            const client = await getRedisClient();
            if (client) {
                const data = await client.get('watchlist');
                if (data) {
                    const list = JSON.parse(data);
                    global.watchlistCache = list;
                    return list;
                }
            }
        } catch (e) {
            console.error("Redis Read Error:", e);
        }
    }

    // 2. Try Memory Cache
    if (global.watchlistCache) {
        return global.watchlistCache;
    }

    // 3. Try File
    ensureDataDir();
    if (fs.existsSync(DATA_FILE)) {
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            const list = JSON.parse(data);
            global.watchlistCache = list;
            return list;
        } catch (error) {
            console.error("File Read Error:", error);
        }
    }

    // 4. Default
    global.watchlistCache = DEFAULT_WATCHLIST;
    return DEFAULT_WATCHLIST;
};

export const saveWatchlist = async (list: WatchlistItem[]) => {
    // Update Memory
    global.watchlistCache = list;

    // Update Redis
    if (REDIS_URL) {
        try {
            const client = await getRedisClient();
            if (client) {
                await client.set('watchlist', JSON.stringify(list));
            }
        } catch (e) {
            console.error("Redis Write Error:", e);
        }
    }

    // Update File
    ensureDataDir();
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
    } catch (error) {
        console.error("File Write Error:", error);
    }
};

// --- Helper Functions ---

export const addToWatchlist = async (item: WatchlistItem) => {
    const list = await getWatchlist();
    if (!list.find(i => i.symbol === item.symbol)) {
        list.push(item);
        await saveWatchlist(list);
    }
};

export const removeFromWatchlist = async (symbol: string) => {
    let list = await getWatchlist();
    list = list.filter(i => i.symbol !== symbol);
    await saveWatchlist(list);
};

export const updateWatchlistItem = async (symbol: string, indicators: WatchlistItem['indicators']) => {
    const list = await getWatchlist();
    const index = list.findIndex(i => i.symbol === symbol);
    if (index !== -1) {
        list[index].indicators = indicators;
        await saveWatchlist(list);
    }
};
