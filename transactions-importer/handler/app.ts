/* eslint-disable prettier/prettier */
import { APIGatewayProxyEvent } from 'aws-lambda';
import fs from 'fs';
import csvParse from 'csv-parse/sync';
/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

export const lambdaHandler = async (event: any): Promise<TransactionInfo[]> => {
    const path = './Transactions-test.csv'; 

    const data = fs.readFileSync(path, 'utf8');  // TODO : fs method may be subject to changes when in the cloud.
    const datapar: any[] = csvParse.parse(data, { columns: true });
    return datapar.map((entry): TransactionInfo => {
        const compatible =  {
            date: `${entry.Data}@${entry.Hora}`,
            quantity: +entry.Quantidade,
            price: +entry.Valor,
            fees: +entry['Custos de transação'],
            ticker: getTickerFromName(entry.Produto),
        };
        return {
            ...compatible,
            orderType: assertOrderType(compatible.quantity, compatible.price),
            product: entry.Produto,
        };
    });
};

function assertOrderType(quantity: number, price: number): string {
    if (quantity > 0 && price < 0) return OrderType.BUY;
    else if( quantity < 0 && price > 0) return OrderType.SELL;
    else if( quantity === 0 && price > 0 ) return OrderType.DIVIDEND;
    else return OrderType.UNKNOWN;
}

function getTickerFromName(productName: string): string{ // Temporary hard, ugly solution, while there is no API available.
    const tickerMap = new Map<string, string>();
    tickerMap.set("ALTRI SGPS", 'ALTR');

    return tickerMap.get(productName) ?? '';
}

enum OrderType {
    BUY = 'BUY',
    SELL = 'SELL',
    DIVIDEND = 'DIV',
    UNKNOWN = ''
} 

interface TransactionInfo {
    date: string;
    quantity: number;
    price: number;
    fees: number;
    ticker: string;
    orderType: string;
    product: string;
}
