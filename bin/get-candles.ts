import type { TickerCandle } from "tradeexchanges/tradingCandles";
import {exchange} from "../tests/setup";
import {describe, expect, test} from '@jest/globals';


const symbol = process.argv[2];
const limit = parseInt(process.argv[3]);
const minuteInterval = parseInt(process.argv[4]);

console.log(symbol, limit);

  
const candles: TickerCandle[] | null  = await exchange.fetchCandles(symbol, minuteInterval,limit);
    
console.log(candles);