import { NextRequest, NextResponse } from 'next/server';
import { unifiedSearch } from '@/lib/data-provider';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q) {
        return NextResponse.json({ results: [] });
    }

    const results = await unifiedSearch(q);

    return NextResponse.json({ results });
}
