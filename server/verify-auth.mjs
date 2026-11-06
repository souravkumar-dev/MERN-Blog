import { app, startServer } from './index.js';

const run = async () => {
  await startServer();
  const server = app.listen(4012);
  try {
    const email = 'authcheck@example.com';
    const password = 'pw123';

    const registerRes = await fetch('http://localhost:4012/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Auth Check', email, password }),
    });

    console.log('REGISTER_STATUS', registerRes.status);
    console.log('REGISTER_BODY', await registerRes.text());

    const loginRes = await fetch('http://localhost:4012/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    console.log('LOGIN_STATUS', loginRes.status);
    console.log('LOGIN_BODY', await loginRes.text());
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
