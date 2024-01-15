const fs = require('fs');
const Papa = require('papaparse');

async function importer() {
    const path = './Transactions.csv'
    const object = fs.readFile(path, 'utf8', (err, data) => {
        const parsed = Papa.parse(data, {
            header: true,
            complete: (results) => {
                const parsedData = results.data
                    .map((entry) => {
                        const compatible = {
                            date: entry.Data,
                            quantity: +entry.Quantidade,
                            price: +entry.Valor,
                            fees: +entry['Custos de transação']
                        };
                        return {
                            ...compatible,
                            ticker: '',
                            dividend: 0,
                            orderType: '',
                            product: entry.Produto,
                            time: entry.Hora
                        };
                    });
                return parsedData;
            }
        });
        // console.log(parsed.complete);

        return parsed;
    });
    return object;
}

console.log(importer());