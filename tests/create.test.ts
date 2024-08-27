import { Order, OrderDirection, OrderQuantityUnit, OrderStatus, OrderType } from "tradeorders/schema";
import { BitFinex } from "../bitfinex";


const exchange = new BitFinex(process.env.API_KEY, process.env.API_SECRET);

const order = new Order(
    {
        instrument_type: 'spot',
        symbol: "tSHIBUSD",
        direction: OrderDirection.LONG,
        status: OrderStatus.PENDING,
        type: OrderType.LIMIT,
        price1: 0.000008000,
        quantity: {
            quantity: 0.3,
            unit: OrderQuantityUnit.QUOTE
        },
    }
)

exchange.submitOrder(order);