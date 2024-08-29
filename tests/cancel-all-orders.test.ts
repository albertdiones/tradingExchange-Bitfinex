import { Order, OrderDirection, OrderQuantityUnit, OrderStatus, OrderType } from "tradeorders/schema";
import { BitFinex } from "../bitfinex";
import { Logger } from 'add_logger';
import HttpClient from "nonChallantJs";




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



const exchange = new BitFinex(process.env.API_KEY, process.env.API_SECRET, {
    client: new HttpClient({
        logger: console,
        cache: new CacheViaNothing(),
        minTimeoutPerRequest: 500,
        maxRandomPreRequestTimeout: 0,
    })
});


exchange.saveOrder = (order) => Promise.resolve(order);

exchange.getSubmittedOrder = (id: number): Promise<Order | null> => Promise.resolve(new Order());

const orders = await exchange.cancelAllOrders();

console.log(orders);