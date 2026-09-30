/** 从请求头解析客户端 IP（Cloudflare / 反代 / 直连） */
export function getClientIp(headers: Headers): string | null {
  const cf = headers.get('cf-connecting-ip')?.trim();
  if (cf) return normalizeIp(cf);

  const real = headers.get('x-real-ip')?.trim();
  if (real) return normalizeIp(real);

  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return normalizeIp(first);
  }

  return null;
}

function normalizeIp(raw: string): string | null {
  const ip = raw.replace(/^\[|\]$/g, '').trim();
  if (!ip || ip === 'unknown') return null;
  // strip IPv4-mapped IPv6
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

export function isPrivateOrLocalIp(ip: string): boolean {
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return true;
  return false;
}
