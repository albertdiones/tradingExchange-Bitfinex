import { type OrderHandler } from 'tradeorders/orderHandler'
import { Order, ORDER_TYPE_LIMIT, OrderDirection, OrderQuantityUnit, OrderStatus, OrderType, type SubmittedOrder } from 'tradeorders/schema';
import crypto from 'crypto';
import HttpClient from 'nonChalantJs';
import {type LoggerInterface, Logger} from 'add_logger';
import type { AssetHolding, AssetWallet, CandleFetcher, Exchange, TickerFetcher } from 'tradeexchanges';
import type { rawExchangeCandle, TickerCandle, TickerData } from 'tradeexchanges/tradingCandles';

export class BitFinex implements Exchange,CandleFetcher {

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

    client: HttpClient;

    logger: LoggerInterface | undefined;

    assetTickerSymbols: {[base: string]: { [quote: string]: string } } = {};
    tickerAssets: {[ticker:string]: {base: string, quote: string}} = {};

    constructor(
        apiKey: string, 
        apiSecret: string, 
        client: HttpClient, 
        options?:  {logger?: LoggerInterface }
    ) {
        if (!apiKey || !apiSecret || !client) {
            throw "Missing required parameters";
        }

        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.nonce = Date.now();
        this.client = client;
        this.logger = options?.logger;
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
            this.logger?.error('Error:', error, error.stack);
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
        return this.assetTickerSymbols[baseAsset]['USD'];
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

                if (!ticker) {
                    this.logger?.warn("Can't find ticker data for symbol", symbol);
                }

                return {
                    data: {
                        symbol: ticker[0],
                        current: ticker[7],
                        high: ticker[9],
                        low: ticker[10],
                        base_volume: ticker[8],
                        quote_volume: ticker[8]*ticker[7],
                        full_data: ticker
                    },
                    fromCache: fromCache
                }
            }
        ).then(
            (result: { data: TickerData; fromCache: boolean; }) => {
                const asset = this.tickerAssets[symbol].base;
                return Promise.all(
                    [
                        this.client.getWithCache(
                            `https://api-pub.bitfinex.com/v2/conf/pub:map:currency:label,pub:map:currency:sym,pub:map:currency:unit,pub:list:currency:margin,pub:map:currency:pool,pub:map:currency:explorer,pub:map:tx:method,pub:list:pair:exchange,pub:list:pair:margin,pub:list:pair:futures,pub:list:currency:futures,pub:list:currency:paper,pub:list:currency:viewonly,pub:info:tx:status,pub:map:category:futures,pub:list:pair:cst,pub:map:pair:sym,pub:list:currency:securities,pub:list:pair:securities,pub:map:tx:method:pool,pub:list:currency:securities:portfolio,pub:info:currency:restrict,pub:info:pair:restrict,pub:list:category:securities,pub:map:category:securities,pub:list:currency:securities:accredited`
                        ),                    
                        this.client.getWithCache(
                            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=250&order=market_cap_desc`
                        ),
                    ]
                )
                .then(
                    ([labelData, marketData]) => {
                        if (!labelData?.response[0]) {
                            this.logger?.warn(`Failed to fetch label datas`);
                            return result;
                        }
                        const label = labelData?.response[0]?.find( ([assetSymbol]: [string, string]) => assetSymbol === asset )?.[1];
                        if (!label) {
                            this.logger?.warn(`Label not found for: ${asset}`)
                            return result;
                        }
                        const circulating_supply = marketData?.response?.find(
                            (data: {name: string, symbol: string, circulating_supply: number}) => {
                                return data.name.toLowerCase() === label.toLowerCase() && data.symbol === asset.toLowerCase();
                            }
                        )?.circulating_supply;

                        result.data.circulating_supply = circulating_supply;

                        return result;
                    }
                )
                .catch(
                    (e) => {
                        this.logger?.warn("error occured during external fetch of circulating supply:", e, e.message, asset)
                        return result;
                    }
                )
            }
        )
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
        const base = symbol.replace(/\:?USD$/,'').replace(/^t/,'');
        this.assetTickerSymbols[base] ??= {};
        
        this.assetTickerSymbols[base]['USD'] = symbol;
        this.tickerAssets[symbol] = { base: base, quote: 'USD' };
        
        return base;
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

                this.logger?.info('checkOrder() result', submittedOrder);
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
                this.logger?.info('cancel result', result);
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
                    this.logger?.error(error);

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

                this.logger?.info('trades', trades);

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

    checkForErrorResponse(result:Array<any>): void {
        if (result[0] !== 'error') {
            return;
        }
        throw Error(`error code: ${result[1]}: ${result[2]}`);
    }

    async fetchCandles(symbol: string, minutes: number, limit: number): Promise<TickerCandle[] | null> {
        const interval = this.minutesToInterval(minutes);
        const url = `${BitFinex.baseUrl}/v2/candles/trade:${interval}:${symbol}/hist?limit=${limit}`;
        return this.client.getNoCache(
            url
        ).then(
            (result) => {

                this.checkForErrorResponse(result as Array<any>);

                return (result as Array<any>).map(
                    (resultCandle:[number, number, number, number, number, number]): TickerCandle => ({
                        open_timestamp: resultCandle[0],
                        close_timestamp: resultCandle[0] + ((minutes*60000)-1),
                        open: resultCandle[1],
                        high: resultCandle[3],
                        low: resultCandle[4],
                        close: resultCandle[2],
                        base_volume: resultCandle[5],
                        quote_volume: resultCandle[5]*resultCandle[2], // estimate; maybe use the average? (open+close/2)
                    })
                );
            }
        );
    }

    /** backwards compatibility with already running trading bot*/
    async fetchCandlesFromExchange(symbol: string, minutes: number, limit: number): Promise<rawExchangeCandle[] | null> {
        return this.fetchCandles(symbol, minutes, limit);
    }

    minutesToInterval(minutes: number): string {
        switch (minutes) {
            case 1:
            case 5:
            case 15:
            case 30:
                return `${minutes}m`
                break;

            case 60:
            case 180:
            case 360:
            case 720:
                return `${minutes/60}h`
                break;

            case 1440:
                return '1D'
                break;

            case 10080:
                return '1W';
                break;
            
            case 20160:
                return '14D';
                break;
            
            case 43200:
                return '1M' 
                break;

            default:
                throw `Unsupported interval: ${minutes}`;
        }
        
    }

}