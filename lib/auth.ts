import { SignJWT, jwtVerify } from 'jose';
import { getSupabase } from './supabase';
import bcrypt from 'bcryptjs';

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

export async function validateCredentials(email: string, password: string): Promise<boolean> {
  const sb = getSupabase();
  const { data } = await sb
    .from('users')
    .select('password_hash')
    .eq('email', email)
    .maybeSingle();

  if (!data) return false;
  return bcrypt.compareSync(password, data.password_hash);
}

export async function createUser(email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> {
  const sb = getSupabase();

  // Check if user already exists
  const { data: existing } = await sb
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    return { success: false, error: 'Email already registered' };
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const { error } = await sb.from('users').insert({
    email,
    password_hash: passwordHash,
    name,
    created_at: new Date().toISOString(),
  });

  if (error) {
    return { success: false, error: 'Failed to create account' };
  }

  return { success: true };
}
