import {exchange} from "./setup";
import {describe, expect, test} from '@jest/globals';



async function cryptoPrice(asset: string): Promise<string> {
    return fetch("https://cryptoprices.cc/"+asset+"/").then(
        r => r.text()
    );  
}
  
test('get BTC ticker data from BitFinex', async () => {
    const symbol = exchange.getAssetDefaultTickerSymbol('BTC');

    expect(symbol).not.toBeNull();

    const response = await exchange.getTickerData(symbol as string);

    expect(response).not.toBeFalsy();

    const priceData = response?.data;

    expect(priceData).not.toBeFalsy();
    expect(priceData?.current).not.toBeFalsy();
    expect(priceData?.quote_volume).not.toBeFalsy();

    const alternativeSourcePrice = parseFloat(await cryptoPrice('BTC'));
    
    const exchangePrice = priceData?.current*1;
    
    const tolerance = parseFloat(process.env.TEST_PRICE_CHECK_TOLERANCE);
    const ceilingPrice = alternativeSourcePrice*(1+tolerance);
    const floorPrice = alternativeSourcePrice*(1-tolerance);

    expect(exchangePrice).toBeGreaterThanOrEqual(floorPrice);
    expect(exchangePrice).toBeLessThanOrEqual(ceilingPrice);

    console.log(exchangePrice, alternativeSourcePrice);
});