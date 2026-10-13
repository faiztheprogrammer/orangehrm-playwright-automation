const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 60000,
    workers: 1,
    retries: 0,
    forbidOnly: !!process.env.CI,
    reporter: [
        ['list'],
        ['html', { open: 'never' }],
    ],

    use: {
        baseURL: 'https://opensource-demo.orangehrmlive.com',
        browserName: 'chromium',
        navigationTimeout: 60000,
        screenshot: 'only-on-failure',
        // CI uploads screenshots/reports; network traces can contain session tokens.
        trace: process.env.CI ? 'off' : 'retain-on-failure',
    },

    expect: {
        timeout: 10000
    }
});
