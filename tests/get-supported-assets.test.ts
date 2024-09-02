import {exchange} from "./setup";
import {describe, expect, test} from '@jest/globals';


test('get assets', async () => {
    const assets: string[] = await exchange.getSupportedAssets();

    expect(assets).toEqual(expect.arrayContaining(["BTC", "ETH", "XRP"]));

    expect(assets).not.toEqual(expect.arrayContaining(["ALBERTO"]));
});