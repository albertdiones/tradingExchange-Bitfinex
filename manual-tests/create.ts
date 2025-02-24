import { Order, OrderDirection, OrderQuantityUnit, OrderStatus, OrderType } from "tradeOrders/schema";
import { BitFinex } from "../bitfinex";


const exchange = new BitFinex(process.env.API_KEY, process.env.API_SECRET);



exchange.saveOrder = (order) => Promise.resolve(order);

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