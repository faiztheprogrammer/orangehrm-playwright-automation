import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AdminPage } from '../pages/AdminPage';

test('nonexistent username search shows no records and Reset clears the search', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const adminPage = new AdminPage(page);

    await loginPage.navigate();
    await loginPage.login('Admin', 'admin123');

    await adminPage.navigate();
    await expect(adminPage.systemUserHeading).toBeVisible();

    const missingUsername = `randomText-${Date.now()}`;
    const searchResponse = await adminPage.searchByUsername(missingUsername);
    expect(searchResponse.status()).toBe(200);

    await expect(adminPage.noUserFoundMessage).toBeVisible();

    const resetSearchFiltersResponse = await adminPage.resetFilters();
    expect(resetSearchFiltersResponse.status()).toBe(200);

    await expect(adminPage.systemUserSearchbox).toHaveValue('');
    await expect(adminPage.noUserFoundMessage).toHaveCount(0);
});


test.describe('User account lifecycle', () => {
    let createdUserId = undefined;
    let username;
    let updatedUsername;

    test.afterEach(async ({ page }) => {
        if (createdUserId !== undefined) {
            const request = page.context().request;
            const userUrl = `/web/index.php/api/v2/admin/users/${createdUserId}`;

            // Confirm ownership before deleting.
            const existingResponse = await request.get(userUrl);
            if (existingResponse.status() === 404) {
                return;
            }
            expect(existingResponse.status()).toBe(200);

            const existingBody = await existingResponse.json();
            expect(existingBody.data.id).toBe(createdUserId);
            expect([username, updatedUsername])
                .toContain(existingBody.data.userName);

            const deleteResponse = await request.delete(
                '/web/index.php/api/v2/admin/users',
                { data: { ids: [createdUserId] } }
            );
            expect(deleteResponse.status()).toBe(200);

            const deletedResponse = await request.get(userUrl);
            expect(deletedResponse.status()).toBe(404);
        }

    });

    test('administrator can create, find, edit, and delete a user', async ({ page }) => {
        const loginPage = new LoginPage(page);
        const adminPage = new AdminPage(page);

        await loginPage.navigate();
        await loginPage.login('Admin', 'admin123');

        // Use the signed-in employee's current name rather than a hardcoded demo name.
        const employeeName = (await page.locator('.oxd-userdropdown-name').innerText()).trim();
        username = `qa_${Date.now()}`;
        updatedUsername = `${username}_edit`;
        const password = 'Password!123';
        await adminPage.navigate();
        await expect(adminPage.systemUserHeading).toBeVisible();
        await adminPage.openAddUserForm();
        await expect(adminPage.addUserHeading).toBeVisible();

        await adminPage.selectUserRole('ESS');
        const selectedEmployeeName = await adminPage.selectEmployee(employeeName);
        await adminPage.selectStatus('Enabled');
        await adminPage.fillUsername(username);
        await adminPage.fillPasswords(password);

        await expect(adminPage.userRoleDropdown).toHaveText('ESS');
        // Compare the selected name while ignoring differences in whitespace formatting.
        const expectedEmployeeName = selectedEmployeeName.replace(/\s+/g, ' ').trim();
        await expect.poll(async () => {
            const actualEmployeeName = await adminPage.employeeNameInput.inputValue();
            return actualEmployeeName.replace(/\s+/g, ' ').trim();
        }).toBe(expectedEmployeeName);
        await expect(adminPage.statusDropdown).toHaveText('Enabled');
        await expect(adminPage.usernameInput).toHaveValue(username);
        await expect(adminPage.passwordInput).toHaveValue(password);
        await expect(adminPage.confirmPasswordInput).toHaveValue(password);
        const creationResponsePromise = page.waitForResponse(response => {
            const url = new URL(response.url());
            return url.pathname === '/web/index.php/api/v2/admin/users' &&
                response.request().method() === 'POST';
        });

        await adminPage.saveUser();

        const creationResponse = await creationResponsePromise;
        const creationBody = await creationResponse.json();

        // Establish that this response identifies the account we created.
        expect(creationBody.data.userName).toBe(username);
        expect(Number.isInteger(creationBody.data.id)).toBe(true);
        expect(creationBody.data.id).toBeGreaterThan(0);

        createdUserId = creationBody.data.id;
        expect(creationResponse.status()).toBe(200);

        await expect(adminPage.systemUserHeading).toBeVisible();

        const searchResponse = await adminPage.searchByUsername(username);
        expect(searchResponse.status()).toBe(200);

        const createdUsernameCell = page.getByRole('cell', { name: username, exact: true });

        await expect(createdUsernameCell).toBeVisible();

        await adminPage.openEditUser(username);
        await expect(adminPage.editUserHeading).toBeVisible();
        await expect(adminPage.usernameInput).toHaveValue(username);

        await adminPage.fillUsername(updatedUsername);

        const updateResponsePromise = page.waitForResponse(response =>
            new URL(response.url()).pathname ===
            `/web/index.php/api/v2/admin/users/${createdUserId}` &&
            response.request().method() === 'PUT'
        );

        await adminPage.saveUser();

        const updateResponse = await updateResponsePromise;
        expect(updateResponse.status()).toBe(200);

        await expect(adminPage.systemUserHeading).toBeVisible();

        const updatedSearchResponse = await adminPage.searchByUsername(updatedUsername);
        expect(updatedSearchResponse.status()).toBe(200);

        await expect(page.getByRole('cell', {
            name: updatedUsername,
            exact: true,
        })).toBeVisible();

        // Reopen the record to check that the saved value persisted.
        await adminPage.openEditUser(updatedUsername);
        await expect(adminPage.editUserHeading).toBeVisible();
        await expect(adminPage.usernameInput).toHaveValue(updatedUsername);

        // Deletion flow
        await adminPage.navigate();
        await expect(adminPage.systemUserHeading).toBeVisible();

        const beforeDeleteSearch = await adminPage.searchByUsername(updatedUsername);
        expect(beforeDeleteSearch.status()).toBe(200);

        const deletionResponse = await adminPage.deleteUser(updatedUsername);
        expect(deletionResponse.status()).toBe(200);

        const afterDeleteSearch = await adminPage.searchByUsername(updatedUsername);
        expect(afterDeleteSearch.status()).toBe(200);
        expect((await afterDeleteSearch.json()).data).toEqual([]);

        await expect(page.getByRole('cell', {
            name: updatedUsername,
            exact: true,
        })).toHaveCount(0);

        await expect(adminPage.noUserFoundMessage).toBeVisible();
    });
});

test('empty Add User form shows validation errors', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const adminPage = new AdminPage(page);

    await loginPage.navigate();
    await loginPage.login('Admin', 'admin123');
    await adminPage.navigate();
    await expect(adminPage.systemUserHeading).toBeVisible();

    await adminPage.openAddUserForm();
    await expect(adminPage.addUserHeading).toBeVisible();
    await adminPage.saveUser();

    await expect(adminPage.userRoleGroup.getByText('Required', { exact: true })).toBeVisible();
    await expect(adminPage.employeeNameGroup.getByText('Required', { exact: true })).toBeVisible();
    await expect(adminPage.statusGroup.getByText('Required', { exact: true })).toBeVisible();
    await expect(adminPage.usernameGroup.getByText('Required', { exact: true })).toBeVisible();
    await expect(adminPage.passwordGroup.getByText('Required', { exact: true })).toBeVisible();
    await expect(adminPage.confirmPasswordGroup.getByText('Passwords do not match', { exact: true })).toBeVisible();
    await expect(adminPage.addUserHeading).toBeVisible();
});
