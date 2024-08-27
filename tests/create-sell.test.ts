import { Order, OrderDirection, OrderQuantityUnit, OrderStatus, OrderType } from "tradeorders/schema";
import { BitFinex } from "../bitfinex";


const exchange = new BitFinex(process.env.API_KEY, process.env.API_SECRET);

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
    }
)

exchange.submitOrder(order);