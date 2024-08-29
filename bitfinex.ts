import { type OrderHandler } from 'tradeorders/orderHandler'
import { Order, ORDER_TYPE_LIMIT, OrderDirection, OrderQuantityUnit, OrderStatus, OrderType, type SubmittedOrder } from 'tradeorders/schema';
import crypto from 'crypto';
import HttpClient from 'nonChallantJs';

export class BitFinex implements OrderHandler {

    static baseUrl = 'https://api.bitfinex.com';

    // @todo: support the other order types (e.g. market)
    static types: {[key: string]: string} = {
        [OrderType.LIMIT]: "EXCHANGE LIMIT",
        [OrderType.MARKET]: "EXCHANGE MARKET",
    }

    static orderStatuses: {[key: string]: OrderStatus} = {
        'ACTIVE': OrderStatus.SUBMITTED,
        'EXECUTED': OrderStatus.FILLED,
        'CANCELED': OrderStatus.CANCELLED,
        'FORCED EXECUTED': OrderStatus.FILLED,
        'PARTIALLY FILLED': OrderStatus.PARTIALLY_FILLED,
    }

    apiKey:string;
    apiSecret:string;

    nonce:number = 0;

    client: HttpClient | undefined;

    constructor(apiKey: string, apiSecret: string, options?:  {client: HttpClient}) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.nonce = Date.now();
        if (options?.client) {
            this.client = options.client;
        }        
    }

    _createHeaders(urlPath:string, body?: {[key:string]: any}) {
   
        const nonce:string = (this.nonce++).toString();
        const payload = body ? JSON.stringify(body) : '';

        // @remove hardcode of url
        const signatureChain = '/api' + urlPath + nonce + payload;
    
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'bfx-nonce': nonce,
            'bfx-apikey': this.apiKey,
            'bfx-signature': crypto
            .createHmac('sha384', this.apiSecret)
            .update(signatureChain)
            .digest('hex')
        }
    }

    _fetch(urlPath:string, body?: {[key:string]: any}): Promise<any> {
        
        const url = `${BitFinex.baseUrl}${urlPath}`;

        const headers = this._createHeaders(urlPath, body);

        console.log('bfx-nonce', headers['bfx-nonce']);

        return this.client.post(url, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: headers
        })
        .then(
            (result) => {
                if (result[0] === 'error') {
                    throw `error on fetching ${urlPath} ${JSON.stringify(result)}`
                }
                return result;
            }
        )
        .catch((error) => {
            console.error('Error:', error, error.stack);
            throw error;
        });
    }

    fetchWallet(): Array<[string, string, number, number, number, string, object]> {    
        return this._fetch('/v2/auth/r/wallets', {})
        .then((result) => {
            return result;
        });
    }

    _getSymbolAsset(symbol: string): string {
        return symbol.substring(1).replace(/USD$/,'');
    }
    
    async submitOrder(order: Order): Promise<Order | void> {

        if (order.quantity.quantity <= 0) {
            throw "Invalid quantity";
        }

        let orderQuantity:number;
        if (order.direction === OrderDirection.SHORT) {
            orderQuantity = -order.quantity.quantity;
        }
        else {
            orderQuantity = order.quantity.quantity;
        }

        if (order.quantity.unit === OrderQuantityUnit.QUOTE) {
            orderQuantity /= order.price1;
        }

        if (order.quantity.unit === OrderQuantityUnit.PERCENT) {
            const wallet = await this.fetchWallet();
            const baseCurrencyBalance = wallet.find(
                (currency: [string, string, number, number]) => {
                    return currency[1] === this._getSymbolAsset(order.symbol);
                }
            );

            orderQuantity = (orderQuantity/100)*baseCurrencyBalance[2];
        }

        const requestBody = {
            type: BitFinex.types[order.type], 
            symbol: order.symbol,
            amount: orderQuantity.toString(),
        };

        if (order.price1) {
            requestBody.price = order.price1?.toString()
        }

        return this._fetch('/v2/auth/w/order/submit', requestBody)
            .then((result) => {
                order.external_id = result[4][0][0];
                return this.saveOrder(order);
            })
    }

    getSubmittedOrder = (id: number): Promise<Order | null> => {
        return Order.findOne(
            {external_id: id}
        );
    }

    saveOrder = (order: Order): Promise<Order> => order.save();
    
    checkOrder(order: SubmittedOrder): Promise<Order | null> {
        return this.getOrdersFromExchange().then(
            (result) => {
                const activeOrder = result.find(
                    (exchangeOrder) => exchangeOrder[0] == parseInt(order.external_id)
                );

                if (activeOrder) {
                    return activeOrder;
                }
                return this.getOrderHistoryFromExchange().then(
                    (result) => {
                        return result.find(
                        (exchangeOrder) => exchangeOrder[0] == parseInt(order.external_id));
                    }
                )
            }
        )
        .then(
            (submittedOrder: Array<any>) => {             

                console.log('checkOrder() result', submittedOrder);
                if (!submittedOrder) {
                    return;
                }

                const dbOrder = this.getSubmittedOrder(Number.parseInt(submittedOrder[0]));

                if (!dbOrder) {
                    throw 'not on the db';
                }

                const exchangeStatus: string = submittedOrder[13];

                let statusKey = exchangeStatus;
                if (exchangeStatus.startsWith('EXECUTED')) {
                    statusKey = 'EXECUTED';
                }

                dbOrder.status = BitFinex.orderStatuses[statusKey] ?? 'unknown';

                if ([OrderStatus.FILLED].includes(dbOrder.status)) {
                    // could be improved, use the last(or first?) trade's timestamp as execution
                    dbOrder.execution_timestamp = Date.now();
                }

                // @todo update trades accordingly

                return this.getTradeOrdersFromExchange(dbOrder)
                    .then(
                        (trades: Array<Array<any>>) => {

                            console.log('trades', trades);

                            if (trades.length <= 0) {
                                return dbOrder;
                            }

                            dbOrder.trades = trades.map(
                                (trade) => {
                                    return trade;
                                }
                            );

                            if (dbOrder.price1 === null) {
                                const lastTrade = trades[trades.length-1];
                                dbOrder.price1 = lastTrade[5];
                            }

                            return dbOrder;
                        }
                    )
                    .then(
                        (order) => this.saveOrder(dbOrder)
                    )
            }
        )
    }
    
    cancelOrder(order: SubmittedOrder): Promise<Order> {
    
        const requestBody = {
            id: parseInt(order.external_id)
        };
    
        return this._fetch('/v2/auth/w/order/cancel', requestBody)
            .then((result) => {
                console.log(result);
                return this.getSubmittedOrder(
                    parseInt(order.external_id)
                )
                .then(
                    (order: Order | null) => {
                        if (!order) {
                            throw 'order not found in mongo';
                        }
                        order.status = OrderStatus.CANCELLED;
                        return this.saveOrder(order);
                    }
                )
            }).catch(
                (error) => {
                    console.error(error);

                    // retry
                    return Bun.sleep(1000).then(
                        () => this.cancelOrder(order)
                    );
                }
            )
    }

    getSubmittedOrders = () => this.getOrdersFromExchange().then((result) => {
        return result.map(
            (order: [number, number, number, symbol]): SubmittedOrder => {
                return { external_id: order[0].toString() }
            }
        )
    })

    async getOrdersFromExchange(): Promise<Array<any>> {    
        return this._fetch('/v2/auth/r/orders');
    }

    

    async getTradeOrdersFromExchange(order: Order): Promise<Array<any>> {
        const urlPath = `/v2/auth/r/order/${order.symbol}:${order.external_id}/trades`;
         
        return this._fetch(urlPath, {});
    }

    
    async getOrderHistoryFromExchange(): Promise<Array<any>> {
        const urlPath = '/v2/auth/r/orders/hist';
    
        return this._fetch(urlPath, {});
    }

    async cancelAllOrders(): Promise<Order[]> {
        return this.getSubmittedOrders()
            .then(
                (orders: SubmittedOrder[]) => Promise.all(
                    orders.map(
                        (order) => this.cancelOrder(order)
                    )
                )
            );
    }

}