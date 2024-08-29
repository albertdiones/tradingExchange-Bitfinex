# tradeexchange-bitfinex

Bitfinex implementation of orderHandler

 * Creating order
 * Checking the status of the order
 * Canceling orders

example:
```
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
```


Todos:
 [x] cancel order
 [x] cancel all orders
 [x] check order
 [x] market order and other types of order
 [x] enforce/implement order direction
  * implement "time in force" in orders
  * enforce/implement quantity unit
  * implement candle fetches for complete usability on trading bot