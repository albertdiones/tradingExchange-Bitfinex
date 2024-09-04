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
 [x] enforce/implement quantity unit
 [x] make the code the dry-er
 [x] implement xhrjson(nonChalantJs) http client
 [x] create automated tests (using jest)
 [x] implement AssetWallet interface
 [x] implement TickerFetcher interface or it's future equivalent
  * implement "time in force" in orders
  * implement priceCandleFetcher or it's future equivalent