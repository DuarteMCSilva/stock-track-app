import { lambdaHandler } from '../../app';
import { expect, describe, it } from '@jest/globals';

describe('Unit test for app handler', function () {
    it('verifies successful response', async () => {
        const result = await lambdaHandler({});
        const expected = [
            {
                date: '08-05-2020@15:48',
                fees: -0.56,
                orderType: 'SELL',
                price: 127.44,
                product: 'ALTRI SGPS',
                quantity: -27,
                ticker: 'ALTR',
            },
            {
                date: '08-05-2020@15:33',
                fees: -4.31,
                orderType: 'SELL',
                price: 613.64,
                product: 'PEUGEOT',
                quantity: -46,
                ticker: '',
            },
            {
                date: '20-04-2020@14:48',
                fees: -4.14,
                orderType: 'BUY',
                price: -288.25,
                product: 'PEUGEOT',
                quantity: 25,
                ticker: '',
            },
            {
                date: '31-03-2020@13:17',
                fees: -4.12,
                orderType: 'BUY',
                price: -249.48,
                product: 'PEUGEOT',
                quantity: 21,
                ticker: '',
            },
            {
                date: '31-03-2020@12:21',
                fees: -0.55,
                orderType: 'BUY',
                price: -97.69,
                product: 'ALTRI SGPS',
                quantity: 27,
                ticker: 'ALTR',
            },
        ];
        expect(result).toEqual(expected);
    });
});
