import type { TickerCandle } from "tradeexchanges/tradingCandles";
import {exchange} from "./setup";
import {describe, expect, test} from '@jest/globals';


// Alternative source price
async function cryptoPrice(asset: string): Promise<string> {
    return fetch("https://cryptoprices.cc/"+asset+"/").then(
        r => r.text()
    );  
}
  
test('get MATIC candles from BitFinex', async () => {
    const limit = 777;
    const candles: TickerCandle[] | null  = await exchange.fetchCandles('tMATIC:USD', 5,limit);
    
    expect(candles).not.toBeNull();
    
    expect(candles?.length).toBe(limit);

    if (candles === null) {
        throw "Candles is null";
    }


    const alternativeSourcePrice = parseFloat(await cryptoPrice('MATIC'));

    const currentCandle = candles[0];

    expect(currentCandle.open_timestamp).toBeGreaterThan(candles[776].open_timestamp);
    
    const tolerance = parseFloat(process.env.TEST_PRICE_CHECK_TOLERANCE);
    const ceilingPrice = alternativeSourcePrice*(1+tolerance);
    const floorPrice = alternativeSourcePrice*(1-tolerance);

    expect(currentCandle.close).toBeGreaterThanOrEqual(floorPrice);
    expect(currentCandle.close).toBeLessThanOrEqual(ceilingPrice);


    const olderCandle = candles[1];

    expect(olderCandle.close_timestamp+1).toBe(currentCandle.open_timestamp);


    expect(candles[2].close_timestamp+1).toBe(olderCandle.open_timestamp);
    
});


test('get XRP 1d candles from BitFinex', async () => {
    const limit = 14;
    const candles: TickerCandle[] | null  = await exchange.fetchCandles('tXRPUSD', 1440,limit);
    
    expect(candles).not.toBeNull();
    
    expect(candles?.length).toBe(limit);
});



test('get XRP 1d candles from BitFinex', async () => {
    const limit = 300;
    const candles: TickerCandle[] | null  = await exchange.fetchCandles('tXRPUSD', 10080,limit);
    
    expect(candles).not.toBeNull();
    
    expect(candles?.length).toBe(limit);

    console.log('oldest candle close', candles[limit-1]);
});