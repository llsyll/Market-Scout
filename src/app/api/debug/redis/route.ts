import { NextResponse } from 'next/server';
import { createClient } from 'redis';

// Helper to sanitize URL for display
const maskUrl = (url: string) => {
    try {
        const u = new URL(url);
        u.password = '****';
        return u.toString();
    } catch {
        return 'Invalid URL format';
    }
}

export async function GET() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        return NextResponse.json({
            status: 'error',
            message: 'REDIS_URL environment variable is NOT set.'
        }, { status: 500 });
    }

    const info = {
        urlConfigured: true,
        maskedUrl: maskUrl(redisUrl),
        connectionStatus: 'pending',
        operationStatus: 'pending',
        error: null as string | null
    };

    const client = createClient({ url: redisUrl });

    try {
        client.on('error', (err) => console.error('Redis Client Error', err));

        await client.connect();
        info.connectionStatus = 'connected';

        const testKey = 'debug:connection_test:' + Date.now();
        await client.set(testKey, 'success');
        const value = await client.get(testKey);
        await client.del(testKey); // Clean up

        if (value === 'success') {
            info.operationStatus = 'success';
            return NextResponse.json({
                status: 'success',
                message: 'Redis connection and R/W operations successful.',
                details: info
            });
        } else {
            throw new Error(`Read value mismatch. Expected 'success', got '${value}'`);
        }

    } catch (error) {
        info.error = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            status: 'error',
            message: 'Redis operation failed.',
            details: info
        }, { status: 500 });
    } finally {
        if (client.isOpen) {
            await client.disconnect();
        }
    }
}
