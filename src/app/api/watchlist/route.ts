import { NextRequest, NextResponse } from 'next/server';
import { getWatchlist, addToWatchlist, removeFromWatchlist, saveWatchlist, WatchlistItem } from '@/lib/watchlist';
import { fetchMixedQuote } from '@/lib/data-provider';

export async function GET() {
    const watchlist = await getWatchlist();

    if (watchlist.length === 0) {
        return NextResponse.json(watchlist);
    }

    try {
        const now = new Date().toISOString();
        const enrichedWatchlist = [];
        let hasNewData = false;

        // Fetch quotes one by one (Finnhub/Binance don't support unified batch effectively for free tier/crypto mix)
        // Parallelize for performance
        const promises = watchlist.map(async (item) => {
            try {
                const quote = await fetchMixedQuote(item.symbol, item.type);
                if (quote) {
                    const data = {
                        price: quote.regularMarketPrice,
                        change: quote.regularMarketChange,
                        changePercent: quote.regularMarketChangePercent,
                        name: quote.shortName
                    };
                    item.lastData = data;
                    item.lastUpdated = now;
                    hasNewData = true;
                    return { ...item, data };
                } else {
                    // Fallback to cache
                    if (item.lastData) {
                        return { ...item, data: item.lastData, isStale: true };
                    }
                    return { ...item, data: undefined, error: 'API returned no data' };
                }
            } catch (e) {
                console.error(`Fetch failed for ${item.symbol}`, e);
                if (item.lastData) {
                    return { ...item, data: item.lastData, isStale: true };
                }
                return {
                    ...item,
                    data: undefined,
                    error: e instanceof Error ? e.message : 'Fetch Failed'
                };
            }
        });

        const results = await Promise.all(promises);

        // Persist cache if we got new data
        if (hasNewData) {
            await saveWatchlist(results);
        }

        return NextResponse.json(results);

    } catch (e) {
        console.error("Live fetch failed, using cache:", e);
        // Fallback to cache for ALL
        const cachedWatchlist = watchlist.map(item => ({
            ...item,
            data: item.lastData,
            isStale: true
        }));
        return NextResponse.json(cachedWatchlist);
    }
}

export async function POST(request: NextRequest) {
    try {
        const body: WatchlistItem = await request.json();
        if (!body.symbol || !body.type) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }
        // Set defaults for indicators if missing
        const newItem: WatchlistItem = {
            ...body,
            indicators: body.indicators || { ma10: false, ma14: false, macd: false, kdj: false }
        };
        // Ensure ma14 is present if it was a partial update or legacy data
        if (newItem.indicators.ma14 === undefined) newItem.indicators.ma14 = false;

        await addToWatchlist(newItem);
        return NextResponse.json({ success: true, watchlist: await getWatchlist() });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
    }

    await removeFromWatchlist(symbol);
    return NextResponse.json({ success: true, watchlist: await getWatchlist() });
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { symbol, indicators } = body;

        if (!symbol || !indicators) {
            return NextResponse.json({ error: 'Symbol and indicators required' }, { status: 400 });
        }

        const { updateWatchlistItem, getWatchlist } = require('@/lib/watchlist');
        await updateWatchlistItem(symbol, indicators);

        return NextResponse.json({ success: true, watchlist: await getWatchlist() });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }
}
