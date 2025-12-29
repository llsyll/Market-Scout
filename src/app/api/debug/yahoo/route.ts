import { NextResponse } from 'next/server';
import { getQuotes } from '@/lib/yahoo';

export async function GET() {
    const results = {};

    try {
        results['valid'] = await getQuotes(['AAPL']);
    } catch (e) { results['valid_error'] = e.message; }

    try {
        results['invalid'] = await getQuotes(['TESLA']);
    } catch (e) { results['invalid_error'] = e.message; }

    try {
        results['mixed'] = await getQuotes(['AAPL', 'TESLA']);
    } catch (e) { results['mixed_error'] = e.message; }

    return NextResponse.json(results);
}
