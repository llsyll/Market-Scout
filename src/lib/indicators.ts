import { SMA, MACD, Stochastic } from 'technicalindicators';
import { Candle } from './yahoo';

export interface IndicatorResult {
    symbol: string;
    price: number;
    signals: {
        ma10Break: boolean;
        ma14Break: boolean;
        macdGoldCrossNodeZero: boolean;
        kdjGoldCrossLow: boolean;
    };
    details: {
        ma10?: number;
        ma14?: number;
        macd?: { macd: number; signal: number; histogram: number };
        kdj?: { k: number; d: number; j: number };
    }
}

export const analyzeIndicators = (symbol: string, candles: Candle[]): IndicatorResult => {
    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const latestClose = closes[closes.length - 1];
    const prevClose = closes[closes.length - 2];

    // 1. MA10
    const ma10 = SMA.calculate({ period: 10, values: closes });
    const currentMA10 = ma10[ma10.length - 1];
    const prevMA10 = ma10[ma10.length - 2];

    // "Just broke through MA10": Today > MA10 AND Yesterday <= PrevMA10
    const ma10Break = latestClose > currentMA10 && prevClose <= prevMA10;

    // 1.5 MA14
    const ma14 = SMA.calculate({ period: 14, values: closes });
    const currentMA14 = ma14[ma14.length - 1];
    const prevMA14 = ma14[ma14.length - 2];
    const ma14Break = latestClose > currentMA14 && prevClose <= prevMA14;

    // 2. MACD (12, 26, 9)
    const macdInput = {
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
    };
    const macdResult = MACD.calculate(macdInput);
    const currentMACD = macdResult[macdResult.length - 1];
    const prevMACD = macdResult[macdResult.length - 2];

    let macdGoldCrossNodeZero = false;
    if (currentMACD && prevMACD &&
        currentMACD.MACD !== undefined && currentMACD.signal !== undefined &&
        prevMACD.MACD !== undefined && prevMACD.signal !== undefined) {
        // Gold Cross: MACD crosses above Signal
        const isGoldCross = currentMACD.MACD > currentMACD.signal && prevMACD.MACD <= prevMACD.signal;
        // Below Zero: Both should be below zero (or just the crossover point)
        const isBelowZero = currentMACD.MACD < 0 && currentMACD.signal < 0;
        macdGoldCrossNodeZero = isGoldCross && isBelowZero;
    }

    // 3. KDJ
    const stochInput = {
        high: highs,
        low: lows,
        close: closes,
        period: 9,
        signalPeriod: 3,
    };
    const stochResult = Stochastic.calculate(stochInput);

    const currentStoch = stochResult[stochResult.length - 1];
    const prevStoch = stochResult[stochResult.length - 2];

    let kdjGoldCrossLow = false;
    let currentK = 0, currentD = 0, currentJ = 0;

    if (currentStoch && prevStoch) {
        currentK = currentStoch.k;
        currentD = currentStoch.d;
        // J = 3K - 2D
        currentJ = 3 * currentK - 2 * currentD;

        const prevK = prevStoch.k;
        const prevD = prevStoch.d;

        const isGoldCross = currentK > currentD && prevK <= prevD;
        const isLow = currentK < 30 && currentD < 30; // Threshold 30

        kdjGoldCrossLow = isGoldCross && isLow;
    }

    // Safe MACD result extraction
    const macdDetails = currentMACD &&
        currentMACD.MACD !== undefined &&
        currentMACD.signal !== undefined &&
        currentMACD.histogram !== undefined
        ? { macd: currentMACD.MACD, signal: currentMACD.signal, histogram: currentMACD.histogram }
        : undefined;

    return {
        symbol,
        price: latestClose,
        signals: {
            ma10Break,
            ma14Break,
            macdGoldCrossNodeZero,
            kdjGoldCrossLow,
        },
        details: {
            ma10: currentMA10,
            ma14: currentMA14,
            macd: macdDetails,
            kdj: { k: currentK, d: currentD, j: currentJ }
        }
    };
};
