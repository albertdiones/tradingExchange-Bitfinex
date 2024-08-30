import {describe, expect, test} from '@jest/globals';
import { Order, OrderDirection, OrderStatus, OrderType } from 'tradeorders/schema';
import exchange from '../manual-tests/test-client.ts';

const symbol = process.env.TEST_ORDER_SYMBOL;

exchange.saveOrder = (order: Order) => Promise.resolve(order);

exchange.getSubmittedOrder = (id: number): Promise<Order | null> => {
    return Promise.resolve(new Order(
        {
            symbol: symbol,
            external_id: id
        }
    ));
}

await Bun.sleep(2000);


test('create order check and cancel', async () => {


    expect(symbol).not.toBeFalsy();
    expect(process.env.TEST_ORDER_BUY_PRICE).not.toBeFalsy();
    expect(process.env.TEST_ORDER_QUANTITY).not.toBeFalsy();
    expect(process.env.TEST_ORDER_QUANTITY_UNIT).not.toBeFalsy();


    const order = new Order(
        {
            instrument_type: 'spot',
            symbol: symbol,
            direction: OrderDirection.LONG,
            status: OrderStatus.PENDING,
            type: OrderType.LIMIT,
            price1: process.env.TEST_ORDER_BUY_PRICE,
            quantity: {
                quantity: process.env.TEST_ORDER_QUANTITY,
                unit: process.env.TEST_ORDER_QUANTITY_UNIT
            },
        }
    )

    const order2 = new Order(
        {
            instrument_type: 'spot',
            symbol: symbol,
            direction: OrderDirection.LONG,
            status: OrderStatus.PENDING,
            type: OrderType.LIMIT,
            price1: process.env.TEST_ORDER_BUY_PRICE,
            quantity: {
                quantity: process.env.TEST_ORDER_QUANTITY,
                unit: process.env.TEST_ORDER_QUANTITY_UNIT
            },
        }
    )

    const order3 = new Order(
        {
            instrument_type: 'spot',
            symbol: symbol,
            direction: OrderDirection.LONG,
            status: OrderStatus.PENDING,
            type: OrderType.LIMIT,
            price1: process.env.TEST_ORDER_BUY_PRICE,
            quantity: {
                quantity: process.env.TEST_ORDER_QUANTITY,
                unit: process.env.TEST_ORDER_QUANTITY_UNIT
            },
        }
    );

    await exchange.submitOrder(order)
        .then(
            async (submittedOrder) => {
                
                const orderId = submittedOrder?.external_id;
                const symbol = submittedOrder?.symbol;

                expect(orderId).not.toBeFalsy();
                expect(symbol).not.toBeFalsy();
            }
        );

    await exchange.submitOrder(order2)
        .then(
            async (submittedOrder) => {
                
                const orderId = submittedOrder?.external_id;
                const symbol = submittedOrder?.symbol;

                expect(orderId).not.toBeFalsy();
                expect(symbol).not.toBeFalsy();
            }
        );

    await exchange.submitOrder(order3)
        .then(
            async (submittedOrder) => {
                
                const orderId = submittedOrder?.external_id;
                const symbol = submittedOrder?.symbol;

                expect(orderId).not.toBeFalsy();
                expect(symbol).not.toBeFalsy();
            }
        );
        
        const orders = await exchange.getActiveOrders();

        console.log(orders);

        // Assuming you want to check if the count is not 3
        expect(orders.length).toBe(3);
    
        await Bun.sleep(2000);
    
        await exchange.cancelAllOrders();
    
        const ordersAfter = await exchange.getActiveOrders();
    
        // Assuming you want to check if the count is 0 after cancellation
        expect(ordersAfter.length).toBe(0);

  }
);