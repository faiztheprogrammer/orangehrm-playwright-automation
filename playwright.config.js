const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    workers: 1,
    retries: 0,
    timeout: 60000,

    reporter: [
        ['list'],
        ['allure-playwright', { resultsDir: 'allure-results' }]
    ],

    expect: {
        timeout: 10000
    },

    use: {
        baseURL: 'https://opensource-demo.orangehrmlive.com/',
        browserName: 'chromium'
    }
})
