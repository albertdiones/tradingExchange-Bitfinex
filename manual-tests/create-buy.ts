import { Order, OrderDirection, OrderQuantityUnit, OrderStatus, OrderType } from "tradeOrders/schema";
import { BitFinex } from "../bitfinex";
import HttpClient from "nonChalantJs";
import exchange from './test-client.ts';


exchange.saveOrder = (order) => Promise.resolve(order);

const price = process.argv.slice(2)[0] ?? -0.8;

const quantity = process.argv.slice(3)[0] ?? 4;

const quantityUnit = process.argv.slice(4)[0] ?? OrderQuantityUnit.QUOTE;

const order = new Order(
    {
        instrument_type: 'spot',
        symbol: "tXRPUSD",
        direction: OrderDirection.LONG,
        status: OrderStatus.PENDING,
        type: OrderType.LIMIT,
        price1: price,
        quantity: {
            quantity: quantity,
            unit: quantityUnit
        },
    }
)

exchange.submitOrder(order)
.then(
    (submittedOrder) => {
        console.log(submittedOrder);
    }
);