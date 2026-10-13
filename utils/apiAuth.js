export async function authenticateApi(request) {
    const loginPageRes = await request.get('/web/index.php/auth/login');
    if (loginPageRes.status() !== 200) throw new Error(`Login page returned HTTP ${loginPageRes.status()}.`);
    const loginHtml = await loginPageRes.text();
    const tokenMatch = loginHtml.match(/:token="&quot;([^&]+)&quot;"/);
    if (!tokenMatch) throw new Error('CSRF token missing from the OrangeHRM login page.');
    const csrfToken = tokenMatch[1];

    const authResponse = await request.post('/web/index.php/auth/validate', {
        maxRedirects: 0,
        form: {
            _token: csrfToken,
            username: 'Admin',
            password: 'admin123'
        }
    });
    const redirect = authResponse.headers().location;
    if (authResponse.status() !== 302 || !redirect ||
        new URL(redirect, loginPageRes.url()).pathname !== '/web/index.php/dashboard/index') {
        throw new Error(`API login did not redirect to Dashboard (HTTP ${authResponse.status()}).`);
    }
    const authenticated = await request.get('/web/index.php/api/v2/admin/users?limit=1');
    if (authenticated.status() !== 200 || !Array.isArray((await authenticated.json()).data)) {
        throw new Error(`Authenticated users probe failed (HTTP ${authenticated.status()}).`);
    }

    return request;
}

export async function getTestEmployeeNumber(request) {
    return (await getTestEmployee(request)).empNumber;
}

export async function getTestEmployee(request) {
    const empRes = await request.get('/web/index.php/api/v2/pim/employees?limit=50');
    if (empRes.status() !== 200) throw new Error(`Employee prerequisite returned HTTP ${empRes.status()}.`);
    const empJson = await empRes.json();
    const employee = empJson.data?.find(employee =>
        Number.isInteger(employee.empNumber) && employee.empNumber > 0 &&
        employee.firstName && employee.lastName && !employee.terminationId);
    if (!employee) throw new Error('No active employee with a usable name/ID is available in the shared demo.');
    return employee;
}

// Used by test-scoped fixtures so cleanup runs before their request context closes,
// with Playwright's teardown budget even when the test body times out.
export async function withUserCleanup(request, use, testInfo) {
    const users = new Map();
    const pendingCreations = [];
    const cleanupErrors = [];
    let workflowError;

    const userCleanup = {
        captureCreation(responseOrPromise, username, allowedUsernames = [username]) {
            const creation = (async () => {
                const response = await responseOrPromise;
                if (!response.ok()) return;

                const body = await response.json();
                const user = body?.data;
                if (typeof username !== 'string' || !username ||
                    !Number.isInteger(user?.id) || user.id <= 0 || user.userName !== username) {
                    throw new Error(`Cannot establish ownership of creation response for ${username ?? 'empty payload'} (returned id=${user?.id}); no account will be deleted.`);
                }

                users.set(user.id, new Set(allowedUsernames));
                testInfo.annotations.push({
                    type: 'created-user',
                    description: `id=${user.id}, username=${username}`,
                });
                return body;
            })();

            // Install a rejection handler immediately, including when a UI click
            // fails before the caller can await the creation response.
            pendingCreations.push(creation.catch(error => cleanupErrors.push(error)));
            return creation;
        },
    };

    try {
        await use(userCleanup);
    } catch (error) {
        workflowError = error;
        throw error;
    } finally {
        await Promise.all(pendingCreations);
        for (const [id, allowedUsernames] of users) {
            try {
                const existing = await request.get(`/web/index.php/api/v2/admin/users/${id}`);
                if (existing.status() === 404) {
                    testInfo.annotations.push({ type: 'user-cleanup', description: `id=${id}: already absent (HTTP 404)` });
                    continue;
                }
                if (existing.status() !== 200) {
                    throw new Error(`Ownership check for user ${id} returned HTTP ${existing.status()}.`);
                }
                const body = await existing.json();
                if (body.data?.id !== id || !allowedUsernames.has(body.data?.userName)) {
                    throw new Error(`Ownership check failed for user ${id}; deletion refused.`);
                }

                const deleted = await request.delete('/web/index.php/api/v2/admin/users', {
                    data: { ids: [id] },
                });
                if (deleted.status() !== 200) {
                    throw new Error(`Cleanup DELETE for user ${id} returned HTTP ${deleted.status()}.`);
                }
                const absent = await request.get(`/web/index.php/api/v2/admin/users/${id}`);
                if (absent.status() !== 404) {
                    throw new Error(`Cleanup verification for user ${id} expected HTTP 404, received ${absent.status()}.`);
                }
                testInfo.annotations.push({ type: 'user-cleanup', description: `id=${id}: deleted (HTTP 200), verified absent (HTTP 404)` });
            } catch (error) {
                cleanupErrors.push(error);
            }
        }

        if (cleanupErrors.length) {
            // Request error call logs may include cookies/headers; retain only
            // the first-line diagnosis instead of dumping authentication material.
            const details = cleanupErrors.map(error => String(error.message || error).split('\n')[0]).join('\n');
            console.error(`Test-user cleanup problems (${testInfo.title}):\n${details}`);
            try {
                await testInfo.attach('user-cleanup-errors', {
                    body: Buffer.from(details), contentType: 'text/plain',
                });
            } catch (error) {
                console.error('Could not attach cleanup diagnostics:', error);
            }
            // Preserve an existing assertion error or timeout; otherwise fail the test.
            if (testInfo.status === 'passed' && !workflowError) {
                throw new Error(`Test-user cleanup failed. See user-cleanup-errors attachment.\n${details}`);
            }
        }
    }
}
