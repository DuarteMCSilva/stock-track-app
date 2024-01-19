const fs = require('fs');
const Papa = require('papaparse');

async function importer() {
    let parsedData; 
    const path = './Transactions.csv'
    fs.readFile(path, 'utf8', (err, data) => {
        Papa.parse(data, {
            header: true,
            complete: (results) => {
                const parData = results.data
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
                parsedData = parData;
                console.log(parsedData);
            }
        });
        return parsedData;
    });

    // const object = fs.readFileSync(path, 'utf-8');
    return parsedData;
}

console.log(importer());