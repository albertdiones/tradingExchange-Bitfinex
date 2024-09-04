import {exchange} from "../tests/setup";
import {describe, expect, test} from '@jest/globals';


const symbols: string[] = await exchange.getTickerSymbols();
symbols.forEach(
    (symbol) => console.log(symbol)
);