import { Order, OrderDirection, OrderQuantityUnit, OrderStatus, OrderType } from "tradeOrders/schema";
import { BitFinex } from "../bitfinex";
import { marketOrder } from "tradeOrders/constructors";

const exchange = new BitFinex(process.env.API_KEY, process.env.API_SECRET);


exchange.saveOrder = (order) => Promise.resolve(order);

const quantity = Number.parseInt(process.argv.slice(2)[0] ?? -4);

const order = marketOrder(
    {type: 'spot', symbol: 'tXRPUSD'}, 
    {quantity: quantity, unit: OrderQuantityUnit.BASE},
    quantity < 0 ?  OrderDirection.SHORT : OrderDirection.LONG 
)

exchange.submitOrder(order)
.then(
    (submittedOrder) => {
        console.log( );
    }
);