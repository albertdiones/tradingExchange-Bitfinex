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

    const priceData = await exchange.getTickerData(symbol as string);

    expect(priceData).not.toBeFalsy();

    expect(priceData?.data).not.toBeFalsy();
    expect(priceData?.data?.current).not.toBeFalsy();

    const alternativeSourcePrice = parseFloat(await cryptoPrice('BTC'));
    
    const exchangePrice = priceData?.data.current*1;

    expect(exchangePrice).toBeGreaterThanOrEqual(alternativeSourcePrice * 0.995);
    expect(exchangePrice).toBeLessThanOrEqual(alternativeSourcePrice * 1.005);

    console.log(exchangePrice, alternativeSourcePrice);
});