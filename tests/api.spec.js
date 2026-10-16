import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";

test('users API rejects an unauthenticated request', async ({ request }) => {
    const response = await request.get('/web/index.php/api/v2/admin/users');

    expect(response.status()).toBe(401);
});

test('authenticated users API can find the Admin account', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login('Admin', 'admin123');

    await expect(page.getByRole('heading', {
        name: 'Dashboard',
        exact: true,
    })).toBeVisible();

    const response = await page.context().request.get(
        '/web/index.php/api/v2/admin/users',
        { params: { username: 'Admin', limit: 50, offset: 0 } }
    );

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.data)).toBe(true);

    const admin = body.data.find(user => user.userName === 'Admin');
    expect(admin).toBeDefined();
    expect(Number.isInteger(admin.id)).toBe(true);
    expect(admin.id).toBeGreaterThan(0);
});

test('authenticated users API returns 404 for a nonexistent user', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login('Admin', 'admin123');

    await expect(page.getByRole('heading', {
        name: 'Dashboard',
        exact: true,
    })).toBeVisible();

    const response = await page.context().request.get(
        '/web/index.php/api/v2/admin/users/2147483647'
    );

    expect(response.status()).toBe(404);
});