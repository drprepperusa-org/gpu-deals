import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'gpu-deals-default-secret-change-me'
);

const TOKEN_EXPIRY = '7d';
const COOKIE_NAME = 'gpu-deals-token';

export { COOKIE_NAME };

export async function createToken(username: string): Promise<string> {
  return new SignJWT({ username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<{ username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { username: payload.username as string };
  } catch {
    return null;
  }
}

export function validateCredentials(username: string, password: string): boolean {
  const validUser = process.env.ADMIN_USERNAME || 'admin';
  const validPass = process.env.ADMIN_PASSWORD || 'admin';
  return username === validUser && password === validPass;
}
