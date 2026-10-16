export class LoginPage {
    constructor(page) {
        this.page = page;
        this.username = page.getByRole('textbox', { name: 'Username' });
        this.password = page.getByPlaceholder('Password');
        this.loginSubmitButton = page.getByRole('button', { name: 'Login' });
    }

    async navigate() {
        await this.page.goto('/web/index.php/auth/login');
    }

    async login(username, password) {
        await this.username.fill(username);
        await this.password.fill(password);
        await this.loginSubmitButton.click();
    }
}