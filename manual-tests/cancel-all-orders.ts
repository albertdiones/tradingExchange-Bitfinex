import { Order, OrderDirection, OrderQuantityUnit, OrderStatus, OrderType } from "tradeOrders/schema";
import exchange from './test-client.ts';


exchange.saveOrder = (order) => Promise.resolve(order);

exchange.getSubmittedOrder = (id: number): Promise<Order | null> => Promise.resolve(new Order());

const orders = await exchange.cancelAllOrders();

console.log(orders);