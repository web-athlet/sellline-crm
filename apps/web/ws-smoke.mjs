import { readFileSync } from 'node:fs';
import { io } from 'socket.io-client';
import { SignJWT } from 'jose';

const env = Object.fromEntries(
  readFileSync(process.argv[2] ?? '.env', 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    }),
);

const URL = 'http://localhost:3001';
const SECRET = new TextEncoder().encode(env.AUTH_JWT_SECRET);
const ISS = env.AUTH_JWT_ISSUER;
const AUD = env.AUTH_JWT_AUDIENCE;

async function mintToken() {
  return await new SignJWT({ sub: 'seed-admin', tid: 'seed-tenant', email: 'admin@acme.dev' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISS)
    .setAudience(AUD)
    .setExpirationTime('5m')
    .sign(SECRET);
}

function connectOnce({ token, label, expect }) {
  // The gateway runs handleConnection after the socket.io handshake completes,
  // so a rejected socket fires 'connect' → 'disconnect' back-to-back. Wait for
  // the socket to settle and report the *final* state, not the first event.
  return new Promise((resolve) => {
    const s = io(URL, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 3000,
      ...(token ? { auth: { token } } : {}),
    });
    let state = 'pending';
    let reason = '';
    s.on('connect', () => {
      state = 'connect';
    });
    s.on('connect_error', (err) => {
      state = 'error';
      reason = err?.message ?? 'unknown';
    });
    s.on('disconnect', (r) => {
      state = 'disconnect';
      reason = r;
    });
    setTimeout(() => {
      s.removeAllListeners();
      s.disconnect();
      resolve({ label, expect, outcome: reason ? `${state}:${reason}` : state });
    }, 1500);
  });
}

const results = [];
results.push(await connectOnce({ token: await mintToken(), label: 'valid-jwt', expect: 'connect' }));
results.push(await connectOnce({ token: 'definitely.not.a.jwt', label: 'bad-jwt', expect: 'reject' }));
results.push(await connectOnce({ token: undefined, label: 'no-jwt', expect: 'reject' }));

let ok = true;
for (const r of results) {
  const pass =
    r.expect === 'connect'
      ? r.outcome === 'connect'
      : r.outcome.startsWith('disconnect') || r.outcome.startsWith('error');
  console.log(`${pass ? 'PASS' : 'FAIL'} ${r.label}: expected=${r.expect} got=${r.outcome}`);
  if (!pass) ok = false;
}
process.exit(ok ? 0 : 1);
