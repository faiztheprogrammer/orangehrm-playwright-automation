export class AdminPage {
    constructor(page) {
        this.page = page;
        this.adminTab = page.getByRole('link', { name: 'Admin' });
        this.systemUserHeading = page.getByRole('heading', { name: 'System Users' });
        this.systemUserSearchbox = page.locator('.oxd-input-group')
            .filter({ has: page.getByText('Username', { exact: true }) })
            .getByRole('textbox');
        this.systemUserSearchButton = page.getByRole('button', { name: 'Search' });
        this.noUserFoundMessage = page.locator('span').filter({ hasText: 'No Records Found' });
        this.resetFiltersButton = page.getByRole('button', { name: 'Reset' });

        this.addButton = page.getByRole('button', { name: /Add/ });
        this.addUserHeading = page.getByRole('heading', { name: 'Add User', exact: true });
        this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
        this.userRoleGroup = page.locator('.oxd-input-group')
            .filter({ has: page.getByText('User Role', { exact: true }) });
        this.employeeNameGroup = page.locator('.oxd-input-group')
            .filter({ has: page.getByText('Employee Name', { exact: true }) });
        this.statusGroup = page.locator('.oxd-input-group')
            .filter({ has: page.getByText('Status', { exact: true }) });
        this.usernameGroup = page.locator('.oxd-input-group')
            .filter({ has: page.getByText('Username', { exact: true }) });
        this.passwordGroup = page.locator('.oxd-input-group')
            .filter({ has: page.getByText('Password', { exact: true }) });
        this.confirmPasswordGroup = page.locator('.oxd-input-group')
            .filter({ has: page.getByText('Confirm Password', { exact: true }) });
        this.userRoleDropdown = this.userRoleGroup.locator('.oxd-select-text-input');
        this.statusDropdown = this.statusGroup.locator('.oxd-select-text-input');
        this.employeeNameInput = this.employeeNameGroup.getByPlaceholder('Type for hints...');
        this.usernameInput = this.usernameGroup.getByRole('textbox');
        this.passwordInput = this.passwordGroup.locator('input');
        this.confirmPasswordInput = this.confirmPasswordGroup.locator('input');

        this.editUserHeading = page.getByRole('heading', { name: 'Edit User' })
    }

    async navigate() {
        await this.adminTab.click();
    }

    async searchByUsername(username) {
        await this.systemUserSearchbox.fill(username);

        const responsePromise = this.page.waitForResponse(response => {
            const url = new URL(response.url());

            return url.pathname === '/web/index.php/api/v2/admin/users' &&
                url.searchParams.get('username') === username &&
                response.request().method() === 'GET';
        });

        await this.systemUserSearchButton.click();

        return await responsePromise;
    }

    async resetFilters() {
        const responsePromise = this.page.waitForResponse(response => {
            const url = new URL(response.url());

            return url.pathname === '/web/index.php/api/v2/admin/users' &&
                !url.searchParams.get('username') &&
                response.request().method() === 'GET';
        });

        await this.resetFiltersButton.click();

        return await responsePromise;
    }

    async openAddUserForm() {
        await this.addButton.click();
    }

    async saveUser() {
        await this.saveButton.click();
    }

    async selectUserRole(role) {
        await this.userRoleDropdown.click();
        await this.page.getByRole('option', { name: role, exact: true }).click();
    }

    async selectStatus(status) {
        await this.statusDropdown.click();
        await this.page.getByRole('option', { name: status, exact: true }).click();
    }

    async selectEmployee(searchText) {
        await this.employeeNameInput.fill(searchText);

        const suggestion = this.page.getByRole('listbox').getByRole('option')
            .filter({ hasText: searchText.split(' ')[0] });

        const selectedName = (await suggestion.innerText()).trim();

        await suggestion.click();
        return selectedName;
    }

    async fillUsername(username) {
        await this.usernameInput.fill(username);
    }

    async fillPasswords(password, confirmation = password) {
        await this.passwordInput.fill(password);
        await this.confirmPasswordInput.fill(confirmation);
    }

    async openEditUser(username) {
        const usernameCell = this.page.getByRole('cell', {
            name: username,
            exact: true
        });

        const userRow = this.page.getByRole('row').filter({
            has: usernameCell
        })

        await userRow.locator('.bi-pencil-fill').click();
    }

    async deleteUser(username) {
        const usernameCell = this.page.getByRole('cell', {
            name: username,
            exact: true,
        });

        const userRow = this.page.getByRole('row').filter({
            has: usernameCell,
        });

        await userRow.locator('.bi-trash').click();

        const deletionResponsePromise = this.page.waitForResponse(response =>
            new URL(response.url()).pathname === '/web/index.php/api/v2/admin/users' &&
            response.request().method() === 'DELETE'
        );

        await this.page.getByRole('button', {
            name: /Yes, Delete/,
        }).click();

        return await deletionResponsePromise;
    }
}
