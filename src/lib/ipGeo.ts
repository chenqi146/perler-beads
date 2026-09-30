import { isPrivateOrLocalIp } from './clientIp';

const COUNTRY_ZH: Record<string, string> = {
  CN: '中国',
  HK: '中国香港',
  MO: '中国澳门',
  TW: '中国台湾',
  US: '美国',
  JP: '日本',
  KR: '韩国',
  SG: '新加坡',
  MY: '马来西亚',
  TH: '泰国',
  VN: '越南',
  PH: '菲律宾',
  ID: '印度尼西亚',
  IN: '印度',
  AU: '澳大利亚',
  GB: '英国',
  DE: '德国',
  FR: '法国',
  CA: '加拿大',
  RU: '俄罗斯',
};

function countryLabel(code: string | null | undefined, fallback?: string | null): string | null {
  if (!code) return fallback || null;
  const upper = code.toUpperCase();
  return COUNTRY_ZH[upper] || fallback || upper;
}

function joinGeoParts(parts: Array<string | null | undefined>): string | null {
  const uniq: string[] = [];
  for (const part of parts) {
    const t = (part || '').trim();
    if (!t) continue;
    if (uniq.includes(t)) continue;
    uniq.push(t);
  }
  return uniq.length ? uniq.join(' · ') : null;
}

type IpWhoResponse = {
  success?: boolean;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
};

/** Cloudflare 国家码作兜底；外网反查城市级归属 */
export async function resolveIpGeo(ip: string, headers?: Headers): Promise<string | null> {
  if (isPrivateOrLocalIp(ip)) return '本地网络';

  const cfCountry = countryLabel(headers?.get('cf-ipcountry'));
  let remote: string | null = null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1800);
    const res = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,country_code,region,city`,
      { signal: ctrl.signal, headers: { Accept: 'application/json' } },
    );
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as IpWhoResponse;
      if (data.success !== false) {
        remote = joinGeoParts([
          countryLabel(data.country_code, data.country),
          data.region,
          data.city,
        ]);
      }
    }
  } catch {
    // 反查失败时用 CF 国家码
  }

  return remote || cfCountry || null;
}
