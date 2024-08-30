import HttpClient from "nonChalantJs";
import { BitFinex } from "../bitfinex";


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

export default new BitFinex(
    process.env.API_KEY,
    process.env.API_SECRET, 
    {
        client: new HttpClient({
            logger: console,
            cache: new CacheViaNothing(),
            minTimeoutPerRequest: 500,
            maxRandomPreRequestTimeout: 0,
        }),
        logger: console
    }
);