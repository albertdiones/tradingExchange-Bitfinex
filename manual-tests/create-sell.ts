import { Order, OrderDirection, OrderQuantityUnit, OrderStatus, OrderType } from "tradeOrders/schema";
import { BitFinex } from "../bitfinex";


const exchange = new BitFinex(process.env.API_KEY, process.env.API_SECRET);


exchange.saveOrder = (order) => Promise.resolve(order);

const price = process.argv.slice(2)[0] ?? -0.8;

const quantity = process.argv.slice(3)[0] ?? 4;

const quantityUnit = process.argv.slice(4)[0] ?? OrderQuantityUnit.QUOTE;

const order = new Order(
    {
        instrument_type: 'spot',
        symbol: "tXRPUSD",
        direction: OrderDirection.SHORT,
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