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

    expect(candles[0].open_timestamp).toBeGreaterThan(candles[776].open_timestamp);
    
    const tolerance = parseFloat(process.env.TEST_PRICE_CHECK_TOLERANCE);
    const ceilingPrice = alternativeSourcePrice*(1+tolerance);
    const floorPrice = alternativeSourcePrice*(1-tolerance);

    expect(candles[0].close).toBeGreaterThanOrEqual(floorPrice);
    expect(candles[0].close).toBeLessThanOrEqual(ceilingPrice);
});


test('get XRP 1d candles from BitFinex', async () => {
    const limit = 14;
    const candles: TickerCandle[] | null  = await exchange.fetchCandles('tXRPUSD', 1440,limit);
    
    expect(candles).not.toBeNull();
    
    expect(candles?.length).toBe(limit);
});