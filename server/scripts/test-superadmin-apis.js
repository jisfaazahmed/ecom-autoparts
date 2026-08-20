require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const email = process.env.SUPER_ADMIN_EMAIL || 'jisfaaz@gmail.com';
const password = process.env.SUPER_ADMIN_PASSWORD;

async function main() {
  const base = process.env.API_BASE || 'http://127.0.0.1:5000/api';

  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = await loginRes.text();
  console.log('LOGIN', loginRes.status, loginBody.slice(0, 200));
  if (!loginRes.ok) return;

  const { accessToken } = JSON.parse(loginBody);
  const headers = { Authorization: `Bearer ${accessToken}` };

  const paths = [
    '/auth/me',
    '/shops',
    '/refunds/admin/list?limit=5',
    '/admin-analytics/superadmin?range=1y',
    '/products/admin/all',
    '/categories',
  ];

  for (const path of paths) {
    const res = await fetch(`${base}${path}`, { headers });
    const text = await res.text();
    console.log('\n---', path, res.status, '---');
    console.log(text.slice(0, 400));
  }
}

main().catch(console.error);
