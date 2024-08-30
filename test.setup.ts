
require('dotenv').config({ path: './.env.test' });


// jest.setup.js
const readline = require('readline');

// Warning message
console.warn(`
    \x1b[31m+==============================================================+
    |--------------------------------------------------------------|
    !!!!!!!!!!!!!!!!!  WARNING: ENVIRONMENT CHECK !!!!!!!!!!!!!!!!!!
    |--------------------------------------------------------------|
    +==============================================================+\x1b[0m
    `);
    

// Create a readline interface to capture input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to wait for a key press
const waitForKeyPress = () => {
    return new Promise(resolve => {
        rl.on('line', () => {
            rl.close();
            resolve();
        });
    });
};

[
    'TEST_ORDER_SYMBOL',
    'TEST_ORDER_BUY_PRICE',
    'TEST_ORDER_SELL_PRICE',
    'TEST_ORDER_QUANTITY',
    'TEST_ORDER_QUANTITY_UNIT'
].forEach(
    (envKey) => {
        console.log(envKey, process.env[envKey]);
    }
);

console.log(`
    Please ensure that your environment variables are properly configured.
    Press enter to continue...`)

// Wait for the developer to press a key
await (async () => {
    await waitForKeyPress();
})();
