import {exchange} from "../tests/setup";
import {describe, expect, test} from '@jest/globals';


const symbol = process.argv.slice(2)[0];

const response = await exchange.getTickerData(symbol);

console.log(response);
