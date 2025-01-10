import HttpClient from "nonChalantJs";
import { BitFinex } from "../bitfinex";

import Logger from 'add_logger';


export class CacheViaNothing {
    async getItem(key: string): Promise<string | null> {
        return null;
    }

    setItem(
        key: string, 
        value: string,
        expirationSeconds: number
    ): void { 
    }
}

export const exchange = new BitFinex(
    process.env.API_KEY,
    process.env.API_SECRET,
    new HttpClient({
        logger: console,
        cache: new CacheViaNothing(),
        minTimeoutPerRequest: 500,
        maxRandomPreRequestTimeout: 0,
    }),
    {
        logger: new Logger('bitfinex'),
    }
);