import { Order, OrderDirection, OrderQuantityUnit, OrderStatus, OrderType, type SubmittedOrder } from "tradeorders/schema";
import { BitFinex } from "../bitfinex";


const exchange = new BitFinex(process.env.API_KEY, process.env.API_SECRET);

exchange.getSubmittedOrder = (external_id) => {
    return new Order(
        {
            external_id: external_id
        }
    );
}

const orderId = process.argv.slice(2)[0];

console.log(orderId);

const order: SubmittedOrder = {
    external_id: orderId
}

const exchangeOrder = await exchange.checkOrder(order);
console.log('exchangeOrder', exchangeOrder);