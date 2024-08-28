import { Order, OrderDirection, OrderQuantityUnit, OrderStatus, OrderType } from "tradeorders/schema";
import { BitFinex } from "../bitfinex";


const exchange = new BitFinex(process.env.API_KEY, process.env.API_SECRET);

const orderId = process.argv.slice(2)[0];

const order = new Order(
    {
        instrument_type: 'spot',
        symbol: "tXRPUSD",
        direction: OrderDirection.LONG,
        status: OrderStatus.PENDING,
        type: OrderType.LIMIT,
        price1: 0.8,
        quantity: {
            quantity: -4,
            unit: OrderQuantityUnit.QUOTE
        },
        external_id: orderId
    }
)

console.log(orderId);

exchange.cancelOrder(order);