/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * 
 */
import AWS from 'aws-sdk';
import { v1 as uuid } from 'uuid';

let dynamoClient = new AWS.DynamoDB.DocumentClient();
const DYNAMO_TABLE = process.env.DynamoTable;

const requestCallback = (err, data) => {
    if(err){
        console.log(data);
        throw new Error(`Failed!`);
    } else {
        console.log("Success!");
        return data;
    }
};

export const validateTransaction = async (event, context) => {
    const inputEvent = JSON.parse(JSON.stringify(event));

    const transactionItem = inputEvent.body.item;
    console.log(transactionItem);

    let quantity;
    let dividend;

    const orderType = transactionItem?.orderType ?? '';
    const orderTypes = ['BUY', 'SELL', 'DIV'];
    const invalidOrderType = !orderTypes.includes(orderType.toUpperCase());
    
    
    if(orderType === 'BUY'){
        quantity = Math.abs(+transactionItem?.quantity);
        dividend = 0;
    } else if (orderType === 'SELL'){
        quantity = -Math.abs(+transactionItem?.quantity);
        dividend = 0;
    } else {
        quantity = 0;
        dividend = transactionItem.dividend ? Math.abs(transactionItem.dividend) : 0
    }
    const invalidQuantity = isNaN(quantity) || (quantity === 0 && orderType !== 'DIV');
    const invalidDividend = isNaN(dividend);

    const price = +transactionItem?.price;
    const invalidPrice = price < 0; 

    const date = transactionItem?.date;
    const ticker = transactionItem?.ticker.toUpperCase();

    let fees = +transactionItem?.fees;
    fees = !fees ? 0 : Math.abs(fees);
     
    if( invalidOrderType || invalidQuantity || invalidDividend || invalidPrice || !date || !ticker ) {
        const log = {
          invalidOrderType,
          invalidQuantity,
          invalidDividend,
          invalidPrice,
          invalidDate: !date,
          invalidTicker: !ticker,
        };
        return {
            valid: false,
            statusCode: 400,
            body: "Invalid input format! ",
            input: JSON.stringify(log)
        }
    }
    const output = {
      valid: true,
      body: { date, orderType, ticker, quantity, price, fees, dividend },
    };
    return output;
}

export const checkTransactionPossible = async (event, context) => {
    const inputEvent = JSON.parse(JSON.stringify(event));

    const transactionItem = inputEvent.body;

    const ticker = transactionItem.ticker;
    const orderType = transactionItem.orderType;
    const requestedQuantity = transactionItem.quantity;

    if(orderType === 'BUY') {
        return {
            statusCode: 200,
            possible: true
        }
    }

    if (!DYNAMO_TABLE || !dynamoClient) {
        return {
            'statusCode': 500,
            'body': "Environment Error!"
        }
    }

    const getParams = {
        TableName: DYNAMO_TABLE,
        Key: { ticker: ticker },
    };

    const existingQuantity = await dynamoClient
        .get(getParams, requestCallback)
        .promise().then( (res) => res.Item.quantity );

    const finalPositionQ = existingQuantity + requestedQuantity;

    const sellCriteria = orderType === 'SELL' && finalPositionQ >= 0;
    const divCriteria = orderType === 'DIV' && existingQuantity > 0;
    return {
        statusCode: 200,
        possible: sellCriteria || divCriteria
    }
}

export const postTransaction = async (event, context) => {
    if (!DYNAMO_TABLE || !dynamoClient) {
        return {
            statusCode: 500,
            body: "Environment Error!"
        }
    }
    const reqBody = event.body;

    const params = {
      TableName: DYNAMO_TABLE,
      Item: {
        id: uuid(),
        date: reqBody.date,
        orderType: reqBody.orderType,
        ticker: reqBody.ticker,
        quantity: reqBody.quantity,
        price: reqBody.price,
        fees: reqBody.fees
      },
    };

    await dynamoClient.put(params, requestCallback).promise();
    return {
        statusCode: 200,
        body: reqBody,
        message: "Created new entry!"
    }
};

export const recalculatePricesHandler = async (event, context) => {
    const newTransaction = event.body;
    const ticker = newTransaction.ticker;

    if (!DYNAMO_TABLE || !dynamoClient) {
        return {
            'statusCode': 500,
            'body': "Environment Error!"
        }
    }

    const getParams = {
        TableName: DYNAMO_TABLE,
        Key: { ticker: ticker },
    };
    const putParams = {
        TableName: DYNAMO_TABLE,
        Item: {},
    };

    const existingEntry = await dynamoClient
        .get(getParams, requestCallback)
        .promise().then( (res) => res.Item );
    if (!existingEntry?.ticker) {
        putParams.Item = {
        ticker,
        quantity: newTransaction.quantity,
        buyPrice: newTransaction.price,
        histDividend: 0,
        };
        const response = await dynamoClient
        .put(putParams, requestCallback)
        .promise();
        return {
        statusCode: 200,
        body: `Created new entry: ${response}`,
        };
    }

    const totalQt = existingEntry.quantity + newTransaction.quantity;
    const newAvgPrice = recalculateAvgPrice(existingEntry, newTransaction);
    const newDividend = +(existingEntry.histDividend + newTransaction.dividend).toFixed(2);

    if (totalQt < 0 || newAvgPrice < 0 || newDividend < 0) {
        return {
        statusCode: 400,
        body: "Some quantities have invalid (negative) values!",
        };
    }

    if (totalQt === 0) {
        const response = await dynamoClient.delete(getParams, requestCallback).promise();
        return {
            statusCode: 200,
            body: `End of position: ${response}`,
        };
    }

    putParams.Item = {
        ticker,
        quantity: totalQt,
        buyPrice: newAvgPrice,
        histDividend: newDividend
    };

    const response = await dynamoClient
        .put(putParams, requestCallback)
        .promise();

    return {
        statusCode: 200,
        body: `Updated entry: ${response}`,
    };
};

function recalculateAvgPrice(existingEntry, newTransaction) {
  const totalQt = existingEntry.quantity + newTransaction.quantity;
  const exTotalPrice = existingEntry.quantity * existingEntry.buyPrice;
  const newTransTotalPrice = newTransaction.quantity * newTransaction.price;
  const newAvgPrice = (exTotalPrice + newTransTotalPrice)/totalQt;
  return +newAvgPrice.toFixed(4);
}
