process.env.NODE_ENV = 'test';

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

import { app, startServer } from '../index.js';

const BASE = 'http://localhost:4000';
let server;

before(async () => {
  await startServer();
  server = app.listen(4000);
  await new Promise((resolve) => server.once('listening', resolve));
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

const request = async (path, options = {}) => {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { status: response.status, body, headers: response.headers };
};

test('health endpoint responds successfully', async () => {
  const response = await request('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
});

test('seeded creator login works and returns session user', async () => {
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'mila@inkflow.io',
      password: 'password123',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.user.role, 'creator');
  assert.equal(response.body.user.email, 'mila@inkflow.io');
});

test('newly registered user can log in and publish a blog', async () => {
  const email = `creator-${Date.now()}@inkflow.io`;
  const registerResponse = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Creator User',
      email,
      password: 'StrongPass123!',
    }),
  });

  assert.equal(registerResponse.status, 201);
  assert.equal(registerResponse.body.user.role, 'creator');

  const loginResponse = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: 'StrongPass123!',
    }),
  });

  assert.equal(loginResponse.status, 200);
  assert.equal(loginResponse.body.user.role, 'creator');

  const cookieHeader = loginResponse.headers.get('set-cookie') || '';
  const createResponse = await request('/api/blogs', {
    method: 'POST',
    headers: {
      Cookie: cookieHeader.split(';')[0],
    },
    body: JSON.stringify({
      title: 'Creator publishing flow check',
      content: '<p>Publishing should work for a newly registered creator.</p>',
      category: 'Wellbeing',
      tags: ['creator', 'publishing'],
      coverImage: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
      status: 'published',
    }),
  });

  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.blog.title, 'Creator publishing flow check');
});

test('published blogs endpoint returns seeded posts', async () => {
  const response = await request('/api/blogs?sort=latest&page=1');
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.blogs));
  assert.ok(response.body.blogs.length >= 2);
  assert.ok(response.body.blogs[0].title.length > 0);
});

test('creator can create a blog with seeded data', async () => {
  const loginResponse = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'mila@inkflow.io',
      password: 'password123',
    }),
    headers: {},
  });

  const cookieHeader = loginResponse.headers.get('set-cookie') || '';
  const response = await request('/api/blogs', {
    method: 'POST',
    headers: {
      Cookie: cookieHeader.split(';')[0],
    },
    body: JSON.stringify({
      title: 'Market-ready writing habits for founders',
      content: '<p>Build a system that helps you ship ideas consistently.</p>',
      category: 'Startups',
      tags: ['founders', 'writing'],
      coverImage: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
      status: 'published',
    }),
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.blog.title, 'Market-ready writing habits for founders');
});
