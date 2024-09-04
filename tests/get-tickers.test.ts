import {exchange} from "./setup";
import {describe, expect, test} from '@jest/globals';


test('get symbols', async () => {
    const symbols: string[] = await exchange.getTickerSymbols();

    const expectedSymbols: string[] = ["BTC", "ETH", "XRP"].map(
        (asset) => exchange.getAssetDefaultTickerSymbol(asset) // USD
    ).filter(
        (symbol): symbol is string => true
    );

    expect(symbols).toEqual(expect.arrayContaining(expectedSymbols));

    expect(symbols).not.toEqual(expect.arrayContaining(["tALBERTOUSDT"]));
});