import { type OrderHandler } from 'tradeorders/orderHandler'
import { Order, ORDER_TYPE_LIMIT, OrderStatus, OrderType, Submitted, type SubmittedOrder } from 'tradeorders/schema';
import crypto from 'crypto';

export class BitFinex implements OrderHandler {

    static baseUrl = 'https://api.bitfinex.com';

    static types: {[key: OrderType]: string} = {
        [OrderType.LIMIT]: "EXCHANGE LIMIT",
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

    constructor(apiKey: string, apiSecret: string) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.nonce = Date.now();
    }

    _createCredentials(urlPath:string, body?: {[key:string]: any}) {
   
        const nonce:string = (this.nonce++).toString() + "" + Math.ceil(Math.random()*1000).toString();
        const payload = body ? JSON.stringify(body) : '';

        // @remove hardcode of url
        const signatureChain = '/api' + urlPath + nonce + payload;
    
        return {
            'bfx-nonce': nonce,
            'bfx-apikey': this.apiKey,
            'bfx-signature': crypto
            .createHmac('sha384', this.apiSecret)
            .update(signatureChain)
            .digest('hex')
        }
    }
    
    submitOrder(order: Order): Promise<Order> {
        const urlPath = '/v2/auth/w/order/submit';
        const url = `${BitFinex.baseUrl}${urlPath}`;
    
        const apiKey = this.apiKey;
        const apiSecret = this.apiSecret;
        const requestBody = {
            type: "EXCHANGE LIMIT", // @todo: remove hardcode of type
            symbol: order.symbol,
            amount: order.quantity.quantity.toString(),
            price: order.price1.toString()
        };

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...this._createCredentials(urlPath, requestBody)
        }
    
        return fetch(url, {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: headers
        })
        .then((response) => response.json())
        .then((result) => {
            order.external_id = result[4][0][0];
            return order;
        })
        .catch((error) => {
            console.error('Error:', error);
            throw error;
        });
    }

    getSubmittedOrder = (id: number): Order | null => {
        return Order.findOne(
            {external_id: id}
        );
    }
    
    checkOrder(order: SubmittedOrder): Promise<Order | null> {
        return this.getOrdersFromExchange().then(
            (result) => {
                if (result[0] === 'error') {
                    return null;
                }
                return result.find(
                    (exchangeOrder) => exchangeOrder[0] == parseInt(order.external_id)
                );
            }
        ).then(
            (submittedOrder: Array<any>) => {             

                const dbOrder = this.getSubmittedOrder(Number.parseInt(submittedOrder[0]));

                if (!dbOrder) {
                    throw 'not on the db';
                }

                dbOrder.status = BitFinex.orderStatuses[submittedOrder[13]] ?? 'unknown';

                if ([OrderStatus.FILLED].includes(dbOrder.status)) {
                    // could be improved, use the last(or first?) trade's timestamp as execution
                    dbOrder.execution_timestamp = Date.now();
                }

                // trades accordingly
                
                return dbOrder;
            }
        )
    }
    
    cancelOrder(order: SubmittedOrder): Promise<Order> {
        const urlPath = '/v2/auth/w/order/cancel';
        const url = `${BitFinex.baseUrl}${urlPath}`;
    
        const requestBody = {
            id: parseInt(order.external_id)
        };

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...this._createCredentials(urlPath, requestBody)
        }
    
        return fetch(url, {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: headers
        })
        .then((response) => response.json())
        .then((result) => {
            console.log(result);
            if (result[0] === 'error') {
                return Bun.sleep(1000).then(
                    () => this.cancelOrder(order)
                );
            }
            order.status = OrderStatus.CANCELLED;
            return order;
        })
        .catch((error) => {
            console.error('Error:', error);
            throw error;
        });
    }

    getSubmittedOrders = () => this.getOrdersFromExchange().then((result) => {
        return result.map(
            (order: [number, number, number, symbol]): SubmittedOrder => {
                console.log('order', order);
                return { external_id: order[0].toString() }
            }
        )
    })

    async getOrdersFromExchange(): Promise<Array<any>> {
        const urlPath = '/v2/auth/r/orders';
        const url = `${BitFinex.baseUrl}${urlPath}`;

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...this._createCredentials(urlPath)
        }
    
        return fetch(url, {
            method: 'POST',
            headers: headers
        })
        .then((response) => response.json())
        .catch((error) => {
            console.error('Error:', error);
            throw error;
        });
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