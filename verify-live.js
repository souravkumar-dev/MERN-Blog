const base = 'http://localhost:4000';
const email = `verify-${Date.now()}@example.com`;
const password = 'StrongPass123!';

async function request(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { status: response.status, headers: response.headers, body };
}

const register = await request('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Verify User',
    email,
    password,
  }),
});
console.log('REGISTER_STATUS=' + register.status);
console.log('REGISTER_ROLE=' + register.body.user?.role);

const login = await request('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
console.log('LOGIN_STATUS=' + login.status);
console.log('LOGIN_ROLE=' + login.body.user?.role);

const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
const blog = await request('/api/blogs', {
  method: 'POST',
  headers: { Cookie: cookie },
  body: JSON.stringify({
    title: 'Verified live publishing flow',
    content: '<p>Live verification for the final publishing flow.</p>',
    category: 'Wellbeing',
    tags: ['verification', 'publishing'],
    coverImage: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
    status: 'published',
  }),
});
console.log('BLOG_STATUS=' + blog.status);
console.log('BLOG_TITLE=' + blog.body.blog?.title);
