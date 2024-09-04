import { type OrderHandler } from 'tradeorders/orderHandler'
import { Order, ORDER_TYPE_LIMIT, OrderDirection, OrderQuantityUnit, OrderStatus, OrderType, type SubmittedOrder } from 'tradeorders/schema';
import crypto from 'crypto';
import HttpClient from 'nonChalantJs';
import {type LoggerInterface, Logger} from 'add_logger';
import type { AssetHolding, AssetWallet, TickerFetcher } from 'tradeexchanges';
import type { TickerData } from 'tradeexchanges/tradingCandles';

export class BitFinex implements OrderHandler, AssetWallet, TickerFetcher {

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

    logger: LoggerInterface;

    constructor(apiKey: string, apiSecret: string, options?:  {client: HttpClient, logger?: LoggerInterface }) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.nonce = Date.now();

        if (options?.client) {
            this.client = options.client;
        }
        this.logger = options.logger;
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

        this.logger?.log('bfx-nonce', headers['bfx-nonce']);

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

                this.logger?.debug(urlPath, result);

                return result;
            }
        )
        .catch((error) => {
            console.error('Error:', error, error.stack);
            throw error;
        });
    }

    
    getTickerSymbols(): Promise<string[]> {
        if (!this.client) {
            return Promise.resolve([]);
        }
        return this.client.getWithCache(
            `${BitFinex.baseUrl}/v2/tickers?symbols=ALL`
        )
        .then(
            ({response}) => {
                const symbols: string[] = response.map(
                    (tickerResponse: [string, number]) => {
                        return tickerResponse[0];
                    }
                );

                const usdSymbols = symbols.filter(
                    (symbol) => symbol.endsWith('USD')
                );

                const validSymbols = usdSymbols.filter(
                    (symbol) => !symbol.startsWith('tTEST') && !symbol.startsWith('f')
                );
                return validSymbols;
            }
        );
    }

    getAssetDefaultTickerSymbol(baseAsset: string): string | null {
        return `t${baseAsset}USD`
    }

    getTickerData(symbol: string): Promise<{ data: TickerData; fromCache: Boolean; } | null> {
        if (!this.client) {
            return Promise.resolve(null);
        }
        return this.client.getWithCache(
            `${BitFinex.baseUrl}/v2/tickers?symbols=ALL`
        ).then(
            ({response, fromCache}) => {
                const ticker = response.find(
                    (ticker: [string]) => ticker[0] === symbol
                );

                return {
                    data: {
                        symbol: ticker[0],
                        current: ticker[7],
                        high: ticker[9],
                        low: ticker[10],
                        base_volume: ticker[8],
                        quote_volume: 0,
                        full_data: ticker
                    },
                    fromCache: fromCache
                }
            }
        );
    }

    getSupportedAssets(): Promise<string[]> {
        return this.getTickerSymbols().
            then(
                (symbols: string[]) => {

                const baseAssets = symbols.map(
                    (symbol) => this._getSymbolAsset(symbol)
                );

                return Array.from(new Set([...baseAssets])) ?? [];
            }
        );
    }

    _getBaseAsset(symbol: string): string {
        return symbol.replace(/\:?USD$/,'').replace(/^t/,'');
    }
    

    // @deprecated use _getBaseAsset(symbol)
    _getSymbolAsset(symbol: string): string {
        return this._getBaseAsset(symbol);
    }
    

    getHoldings(): Promise<AssetHolding[]> {
        return this.fetchWallet()
            .then(
                (results) => results.map(
                    (resultAsset) => (
                        {
                            name: resultAsset[1], 
                            amount: resultAsset[2]
                        }
                    )
                )
            )
    }

    fetchWallet(): Promise<Array<[string, string, number, number, number, string, object]>> {    
        return this._fetch('/v2/auth/r/wallets', {})
        .then((result) => {
            return result;
        });
    }
    async submitOrder(order: Order): Promise<Order | void> {

        if (order.quantity.quantity <= 0) {
            throw "Invalid quantity";
        }

        if (order.external_id !== null) {
            throw "Resubmission of an existing order";
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

            const holdings = await this.getHoldings();

            if (order.direction === OrderDirection.LONG ) {
                const assetHolding = holdings.find(
                    (holding: AssetHolding) => {
                        return holding.name === 'USD';
                    }
                );
                orderQuantity = ((orderQuantity/100)*assetHolding.amount)/order.price1;
            }
            else if (order.direction === OrderDirection.SHORT) {
                const assetHolding = holdings.find(
                    (holding: AssetHolding) => {
                        return holding.name === this._getSymbolAsset(order.symbol);
                    }
                );
                orderQuantity = (orderQuantity/100)*assetHolding.amount;
            }
            else {
                throw "Unknown direction";
            }            
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
            async (submittedOrder: Array<any>) => {             

                console.log('checkOrder() result', submittedOrder);
                if (!submittedOrder) {
                    return;
                }

                const dbOrder = await this.getSubmittedOrder(Number.parseInt(submittedOrder[0]));

                if (!dbOrder) {
                    throw 'not on the db';
                }

                

                return this.syncOrder(submittedOrder, dbOrder);
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

    syncOrder(exchangeOrder: Array<any>, dbOrder: Order): Promise<Order> {
        const exchangeStatus: string = exchangeOrder[13];

        if (exchangeOrder[6] > 0) {
            dbOrder.direction = OrderDirection.LONG;
        }
        else if (exchangeOrder[6] < 0) {
            dbOrder.direction = OrderDirection.SHORT;
        }

        let statusKey = exchangeStatus;
        if (exchangeStatus.startsWith('EXECUTED')) {
            statusKey = 'EXECUTED';
        }

        dbOrder.status = BitFinex.orderStatuses[statusKey] ?? 'unknown';

        if ([OrderStatus.FILLED].includes(dbOrder.status)) {
            // could be improved, use the last(or first?) trade's timestamp as execution
            dbOrder.execution_timestamp = Date.now();
        }

        if (!dbOrder.submission_timestamp) {
            dbOrder.submission_timestamp = exchangeOrder[4];
        }

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
        );
    }

    getActiveOrders(): Promise<Order[]> {
        return this.getOrdersFromExchange().then(
            (result) => {
                return Promise.all(
                    result.map(
                        (exchangeOrder: Array<any>) => {
                            return this.getSubmittedOrder(exchangeOrder[0]).then(
                                (dbOrder: Order | null) => {
                                    if (!dbOrder) {
                                        return null;
                                    }
                                    return this.syncOrder(exchangeOrder, dbOrder);
                                }
                            );
                        }
                    )
                ).then(
                    (orders): Order[] => {
                        return orders.filter(
                            (order): order is Order => Boolean(order)
                        )
                    }
                )
            }
        )
    }

}