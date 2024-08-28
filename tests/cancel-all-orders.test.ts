import { Order, OrderDirection, OrderQuantityUnit, OrderStatus, OrderType } from "tradeorders/schema";
import { BitFinex } from "../bitfinex";


const exchange = new BitFinex(process.env.API_KEY, process.env.API_SECRET);



exchange.saveOrder = (order) => Promise.resolve(order);

const orders = await exchange.cancelAllOrders();

console.log(orders);