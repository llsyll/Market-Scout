import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || 'AAPL';

    // 1. Check Env Var
    const apiKey = process.env.FINNHUB_API_KEY;
    const envStatus = {
        hasKey: !!apiKey,
        keyPrefix: apiKey ? apiKey.substring(0, 3) + '...' : 'N/A'
    };

    // 2. Perform Direct Fetch (Bypass library)
    let fetchResult = null;
    let error = null;

    try {
        if (!apiKey) throw new Error("Missing FINNHUB_API_KEY");

        const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${apiKey}`;
        const startTime = Date.now();
        const res = await fetch(url);
        const duration = Date.now() - startTime;

        const status = res.status;
        const data = await res.json();

        fetchResult = {
            duration,
            status,
            resultCount: data.result ? data.result.length : 0,
            rawTopResult: data.result ? data.result[0] : null,
            fullData: data
        };

    } catch (e) {
        error = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json({
        check: 'Search Debug',
        query: q,
        env: envStatus,
        fetch: fetchResult,
        error: error
    });
}
