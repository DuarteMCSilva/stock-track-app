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
let dynamoClient = new AWS.DynamoDB.DocumentClient();
const DYNAMO_TABLE = process.env.DynamoTable;

const requestCallback = (err, data) => {
    if(err){
        throw new Error(`Failed!`);
    } else {
        console.log("Success!");
        return data;
    }
};

export const postTransaction = async (event, context) => {
    // TODO: Clear unnecessary logs after finishing workflow.
    console.log(event);

    const reqEvent = JSON.parse(JSON.stringify(event));
    console.log('Table: ' + DYNAMO_TABLE);
    console.log('Dynamo client defined: ' + !!dynamoClient);

    if (!DYNAMO_TABLE || !dynamoClient) {
        return {
            'statusCode': 500,
            'body': "Environment Error!"
        }
    }
    const reqBody = parsedRequestBody(reqEvent.body);
    console.log(reqBody)

    const transactionItem = reqBody.item;
    console.log(transactionItem)

    const date = transactionItem.date;
    const orderType = transactionItem.orderType;
    const ticker = transactionItem.ticker;
    const quantity = +transactionItem.quantity;
    const price = +transactionItem.price;
    const fees = +transactionItem.fees;

    console.log(date)
    console.log(ticker)
    console.log(orderType)

    const invalidInput = !transactionItem || !date || !orderType || !ticker

    if( invalidInput ) {
        return {
            'statusCode': 400,
            'body': "Invalid input format!"
        }
    }

    const params =  { 
        TableName: DYNAMO_TABLE,
        Item: {
            date, orderType, ticker, quantity, price, fees
        }
    }

    console.log(params)

    const result = await dynamoClient.put(params, requestCallback).promise();

    console.log(result)
    return {
        'statusCode': 200,
        'body': JSON.stringify( result )
    }
};

export const recalculatePricesHandler = async (event, context) => {
    // TODO: Distribute responsability and improve code readability. 
    const reqEvent = JSON.parse(JSON.stringify(event));

    if (!DYNAMO_TABLE || !dynamoClient) {
        return {
            'statusCode': 500,
            'body': "Environment Error!"
        }
    }
    const reqBody = parsedRequestBody(reqEvent.body);

    const newTransaction = reqBody.item;

    const ticker = newTransaction.ticker;

    const invalidInput = !ticker;

    if( invalidInput ) {
        return {
            'statusCode': 400,
            'body': "Invalid input format!"
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
        quantity: +newTransaction.quantity,
        buyPrice: +newTransaction.price,
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
        quantity: +totalQt,
        buyPrice: +newAvgPrice,
        histDividend: +newDividend
    };

    const response = await dynamoClient
        .put(putParams, requestCallback)
        .promise();

    return {
        statusCode: 200,
        body: `Updated entry: ${response}`,
    };
};

function parsedRequestBody(body) {
    if (!body) return "";
    if (typeof body === "string") {
        return JSON.parse(body);
    } else {
        return JSON.parse(JSON.stringify(body));
    }
}

function recalculateAvgPrice(existingEntry, newTransaction) {
  const totalQt = existingEntry.quantity + newTransaction.quantity;
  const exTotalPrice = existingEntry.quantity * existingEntry.buyPrice;
  const newTransTotalPrice = newTransaction.quantity * newTransaction.price;
  const newAvgPrice = (exTotalPrice + newTransTotalPrice)/totalQt;
  return +newAvgPrice.toFixed(5);
}
