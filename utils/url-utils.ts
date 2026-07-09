import { URL } from 'url';
import path from 'path';

export function normalizeUrl(raw: string, base?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  try {
    // If raw is absolute, new URL will succeed
    const u = base ? new URL(trimmed, base) : new URL(trimmed);
    // remove trailing slash for normalized comparison except root
    const pathname = u.pathname === '/' ? '/' : u.pathname.replace(/\/$/, '');
    const normalized = `${u.protocol}//${u.hostname}${pathname}${u.search}`;
    return normalized;
  } catch (e) {
    // treat as path
    const joined = base ? new URL(trimmed, base).toString() : path.normalize(trimmed);
    return joined;
  }
}

export function isSameUrl(a: string, b: string, base?: string): boolean {
  try {
    const na = normalizeUrl(a, base);
    const nb = normalizeUrl(b, base);
    return na === nb;
  } catch (e) {
    return a === b;
  }
}
