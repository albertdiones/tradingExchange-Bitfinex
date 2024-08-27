import { type OrderHandler } from 'tradeorders/orderHandler'
import { ORDER_TYPE_LIMIT, OrderType, type Order } from 'tradeorders/schema';
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
    
    submitOrder(order: Order): Promise<Order> {
        const urlPath = '/v2/auth/w/order/submit';
        const url = `${BitFinex.baseUrl}${urlPath}`;
    
        const apiKey = this.apiKey;
        const apiSecret = this.apiSecret;
        
        const nonce = Date.now().toString();
        const body = {
            type: "EXCHANGE LIMIT",
            symbol: order.symbol,
            amount: order.quantity.quantity.toString(),
            price: order.price1.toString(),
            request: urlPath,
            nonce: nonce
        };

        const payload = JSON.stringify(body);
        
        console.log(payload);

        const signatureChain = '/api/v2/auth/w/order/submit' + nonce + payload;
    
        const signature = crypto
            .createHmac('sha384', apiSecret)
            .update(signatureChain)
            .digest('hex');

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'bfx-nonce': nonce,
            'bfx-apikey': apiKey,
            'bfx-signature': signature
        }
    
        return fetch(url, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: headers
        })
        .then((response) => response.json())
        .then((result) => {
            console.log(result);
            order.external_id = result[4][0];
            return order;
        })
        .catch((error) => {
            console.error('Error:', error);
            throw error;
        });
    }

}