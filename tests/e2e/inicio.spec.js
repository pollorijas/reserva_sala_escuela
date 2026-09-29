// Pruebas de navegador de la página de inicio (index.html)
const { test, expect } = require('@playwright/test');

test('ofrece los dos accesos y no menciona funciones eliminadas', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('a[href="admin.html"]')).toBeVisible();
    await expect(page.locator('a[href="profesores.html"]')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/correo/i);
});

test('los enlaces llevan a las páginas correctas', async ({ page }) => {
    await page.goto('/index.html');
    await page.click('a[href="profesores.html"]');
    await expect(page).toHaveURL(/profesores\.html$/);
});
