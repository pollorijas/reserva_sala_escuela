const { defineConfig } = require('@playwright/test');

const PUERTO = 4173;

module.exports = defineConfig({
    testDir: './e2e',
    timeout: 30000,
    expect: { timeout: 7000 },
    fullyParallel: true,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: `http://localhost:${PUERTO}`,
        locale: 'es-CL',
        timezoneId: 'America/Santiago',
        acceptDownloads: true,
        trace: 'retain-on-failure',
        launchOptions: {
            // En entornos con un Chromium ya instalado (sin descargar el de Playwright)
            // se puede indicar su ruta: CHROMIUM_PATH=/ruta/a/chromium npm run test:e2e
            executablePath: process.env.CHROMIUM_PATH || undefined
        }
    },
    webServer: {
        command: 'node servidor.js',
        port: PUERTO,
        reuseExistingServer: !process.env.CI
    }
});
