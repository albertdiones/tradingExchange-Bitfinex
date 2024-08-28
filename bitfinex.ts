import { type OrderHandler } from 'tradeorders/orderHandler'
import { ORDER_TYPE_LIMIT, OrderStatus, OrderType, type Order } from 'tradeorders/schema';
import crypto from 'crypto';

export class BitFinex implements OrderHandler {

    static baseUrl = 'https://api.bitfinex.com';

    static types: {[key: OrderType]: string} = {
        [OrderType.LIMIT]: "EXCHANGE LIMIT",
    }

    apiKey:string;
    apiSecret:string;

    constructor(apiKey: string, apiSecret: string) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
    }

    _createCredentials(urlPath:string, body: {[key:string]: any}) {
   
        const nonce = Date.now().toString();

        const payload = JSON.stringify(body);

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
    
    cancelOrder(order: Order): Promise<Order> {
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

        console.log('requestBody', requestBody);
    
        return fetch(url, {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: headers
        })
        .then((response) => response.json())
        .then((result) => {
            console.log(result);
            order.status = OrderStatus.CANCELLED;
            return order;
        })
        .catch((error) => {
            console.error('Error:', error);
            throw error;
        });
    }

}