const STORAGE_KEY = 'aguia_tenant_branding';

const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'platform', 'localhost']);

export function resolveTenantSlugFromHost(hostname = window.location.hostname) {
  const host = String(hostname || '').toLowerCase().split(':')[0];
  const parts = host.split('.').filter(Boolean);
  if (parts.length >= 3) {
    const sub = parts[0];
    if (!RESERVED_SUBDOMAINS.has(sub)) return sub;
  }
  if (parts.length === 2 && parts[1] === 'localhost' && !RESERVED_SUBDOMAINS.has(parts[0])) {
    return parts[0];
  }
  return import.meta.env.VITE_TENANT_SLUG || null;
}

export function getCachedBranding() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function cacheBranding(data) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function applyTenantBranding(branding) {
  if (!branding) return;

  const root = document.documentElement;
  if (branding.primary_color) {
    root.style.setProperty('--brand-primary', branding.primary_color);
  }

  const brandName = branding.brand_name || branding.trade_name || branding.name;
  if (brandName) {
    root.dataset.tenantBrand = brandName;
  }

  if (branding.favicon_url) {
    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = branding.favicon_url;
  }
}

export async function loadTenantBranding(apiClient) {
  const slug = resolveTenantSlugFromHost();
  const cached = getCachedBranding();
  if (cached && (!slug || cached.slug === slug)) {
    applyTenantBranding(cached);
    return cached;
  }

  try {
    const res = await apiClient.getTenantBranding(slug);
    const data = res.data;
    if (data) {
      cacheBranding(data);
      applyTenantBranding(data);
    }
    return data;
  } catch {
    if (!slug) {
      try {
        const fallback = await apiClient.getTenantBranding();
        if (fallback.data) {
          cacheBranding(fallback.data);
          applyTenantBranding(fallback.data);
          return fallback.data;
        }
      } catch {
        /* ignore */
      }
    }
    return cached;
  }
}
