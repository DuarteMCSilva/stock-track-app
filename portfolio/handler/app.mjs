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

const putCallback = (err, data) => {
    if(err){
        throw new Error(`Failed to persist!`);
    } else {
        console.log("Success!");
        return data;
    }
};

export const postTransaction = async (event, context) => {
    // TODO: Clear unnecessary logs after finishing workflow.
    console.log(event);

    const reqEvent = JSON.parse(JSON.stringify(event));
    console.log('Table: ' + DYNAMO_TABLE)
    console.log('Dynamo client defined: ' + !!dynamoClient)

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

    const result = await dynamoClient.put(params, putCallback).promise();

    console.log(result)
    return {
        'statusCode': 200,
        'body': JSON.stringify( result )
    }
};

function parsedRequestBody(body) {
    if(!body) return '';
    if(typeof body === 'string'){
        return JSON.parse(body);
    } else {
        return JSON.parse(JSON.stringify(body));
    }
};
