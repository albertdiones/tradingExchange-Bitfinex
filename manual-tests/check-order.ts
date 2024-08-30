import { Order, OrderDirection, OrderQuantityUnit, OrderStatus, OrderType, type SubmittedOrder } from "tradeorders/schema";
import { BitFinex } from "../bitfinex";


const exchange = new BitFinex(process.env.API_KEY, process.env.API_SECRET);


exchange.saveOrder = (order) => Promise.resolve(order);

const orderId = process.argv.slice(2)[0];
const symbol = process.argv.slice(3)[0];


exchange.getSubmittedOrder = (external_id) => {
    return new Order(
        {
            symbol: symbol,
            external_id: external_id
        }
    );
}

console.log(orderId);

const order: SubmittedOrder = {
    external_id: orderId
}

const exchangeOrder = await exchange.checkOrder(order);
console.log('exchangeOrder', exchangeOrder);