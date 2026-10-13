import { test as base, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { authenticateApi, getTestEmployeeNumber, withUserCleanup } from '../../utils/apiAuth';
import { LoginPage } from '../../pages/LoginPage';
import { AdminPage } from '../../pages/AdminPage';

const test = base.extend({
    userCleanup: async ({ request }, use, testInfo) => {
        await withUserCleanup(request, use, testInfo);
    },
});

test.describe('OrangeHRM User Management API Suite', () => {

    test('unauthenticated request to users endpoint returns 401 Unauthorized', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
            baseURL: 'https://opensource-demo.orangehrmlive.com'
        });

        try {
            const response = await unauthContext.get('/web/index.php/api/v2/admin/users');
            expect(response.status()).toBe(401);
        } finally {
            await unauthContext.dispose();
        }
    });

    test('get users list returns 200 OK with paginated data', async ({ request }) => {
        await authenticateApi(request);

        const response = await request.get('/web/index.php/api/v2/admin/users?limit=10&offset=0');
        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.data.length).toBeGreaterThan(0);
        expect(body.data.length).toBeLessThanOrEqual(10);
        expect(body.meta).toHaveProperty('total');
        expect(typeof body.meta.total).toBe('number');
        expect(body.meta.total).toBeGreaterThanOrEqual(body.data.length);
        expect(body.data[0]).toHaveProperty('id');
        expect(body.data[0]).toHaveProperty('userName');
    });

    test('get non-existent user returns 404 Record Not Found', async ({ request }) => {
        await authenticateApi(request);

        const response = await request.get('/web/index.php/api/v2/admin/users/999999');
        expect(response.status()).toBe(404);

        const body = await response.json();
        expect(body.error.message).toBe('Record Not Found');
    });

    test('create user with missing required fields returns 422 Unprocessable Entity', async ({ request, userCleanup }) => {
        await authenticateApi(request);

        const response = await request.post('/web/index.php/api/v2/admin/users', {
            data: {}
        });
        // An unexpected successful response has no supplied username to establish
        // ownership. Report it explicitly rather than deleting an unidentified account.
        await userCleanup.captureCreation(response, undefined);
        expect(response.status()).toBe(422);

        const body = await response.json();
        expect(body.error.status).toBe('422');
        expect(body.error.message).toBe('Invalid Parameter');
        expect(body.error.data.invalidParamKeys).toEqual(
            expect.arrayContaining(['username', 'password', 'userRoleId', 'empNumber', 'status'])
        );
    });

    test('crud lifecycle: create, read, update, and delete user via API', async ({ request, userCleanup }) => {
        await authenticateApi(request);
        const empNumber = await getTestEmployeeNumber(request);

        const initialUsername = `api_user_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
        const updatedUsername = `${initialUsername}_upd`;
        const createResponse = await request.post('/web/index.php/api/v2/admin/users', {
            data: {
                username: initialUsername,
                password: 'Password!123',
                status: true,
                userRoleId: 2,
                empNumber: empNumber
            }
        });
        const createBody = await userCleanup.captureCreation(
            createResponse, initialUsername, [initialUsername, updatedUsername],
        );
        expect(createResponse.status()).toBe(200);
        const userId = createBody.data.id;
        expect(userId).toBeDefined();
        expect(createBody.data.userName).toBe(initialUsername);

        const getResponse = await request.get(`/web/index.php/api/v2/admin/users/${userId}`);
        expect(getResponse.status()).toBe(200);
        const getBody = await getResponse.json();
        expect(getBody.data.userName).toBe(initialUsername);

        const updateResponse = await request.put(`/web/index.php/api/v2/admin/users/${userId}`, {
            data: {
                username: updatedUsername,
                password: '',
                status: true,
                userRoleId: 2,
                empNumber: empNumber,
                changePassword: false
            }
        });
        expect(updateResponse.status()).toBe(200);
        const updateBody = await updateResponse.json();
        expect(updateBody.data.userName).toBe(updatedUsername);
        const persistedResponse = await request.get(`/web/index.php/api/v2/admin/users/${userId}`);
        expect(persistedResponse.status()).toBe(200);
        expect((await persistedResponse.json()).data.userName).toBe(updatedUsername);

        const deleteResponse = await request.delete('/web/index.php/api/v2/admin/users', {
            data: {
                ids: [userId]
            }
        });
        expect(deleteResponse.status()).toBe(200);

        const verifyDeletedResponse = await request.get(`/web/index.php/api/v2/admin/users/${userId}`);
        expect(verifyDeletedResponse.status()).toBe(404);
    });

    test('hybrid flow: fast API user setup followed by UI verification and API cleanup', async ({ request, page, userCleanup }) => {
        await authenticateApi(request);
        const empNumber = await getTestEmployeeNumber(request);

        const testUsername = `api_ui_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
        const createResponse = await request.post('/web/index.php/api/v2/admin/users', {
            data: {
                username: testUsername,
                password: 'Password!123',
                status: true,
                userRoleId: 2,
                empNumber: empNumber
            }
        });
        await userCleanup.captureCreation(createResponse, testUsername);
        expect(createResponse.status()).toBe(200);
        const loginPage = new LoginPage(page);
        await loginPage.navigate();
        await loginPage.login('Admin', 'admin123');
        await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

        const adminPage = new AdminPage(page);
        await adminPage.navigateToAdmin();
        await expect(adminPage.systemUsersHeading).toBeVisible();

        await adminPage.searchByUsername(testUsername);
        const userRow = adminPage.getUserRow(testUsername);
        await expect(userRow).toBeVisible();
        await expect(userRow.getByRole('cell', { name: 'ESS', exact: true })).toBeVisible();
        await expect(userRow.getByRole('cell', { name: 'Enabled', exact: true })).toBeVisible();
    });

    test('cleanup deletes a test-owned user after a workflow failure', async ({ request, userCleanup }, testInfo) => {
        await authenticateApi(request);
        const empNumber = await getTestEmployeeNumber(request);
        const username = `api_cleanup_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
        const originalError = new Error('Simulated post-creation workflow failure');
        let userId;

        await expect(withUserCleanup(request, async cleanup => {
            const response = await request.post('/web/index.php/api/v2/admin/users', {
                data: { username, password: 'Password!123', status: true, userRoleId: 2, empNumber },
            });
            // The outer fixture provides a fallback if this cleanup regression fails.
            const body = await userCleanup.captureCreation(response, username);
            await cleanup.captureCreation(response, username);
            expect(response.status()).toBe(200);
            userId = body.data.id;
            throw originalError;
        }, testInfo)).rejects.toBe(originalError);

        const absent = await request.get(`/web/index.php/api/v2/admin/users/${userId}`);
        expect(absent.status()).toBe(404);
    });
});
