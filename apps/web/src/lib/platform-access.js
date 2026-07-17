const PLATFORM_ROLES = ['platform_super_admin', 'platform_admin', 'platform_support', 'platform_finance'];

export function getStoredAdminUser() {
  try {
    return JSON.parse(localStorage.getItem('admin_user') || 'null');
  } catch {
    return null;
  }
}

export function hasPlatformAccess(user) {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  if (PLATFORM_ROLES.includes(user.role)) return true;
  const perms = user.permissions || [];
  if (perms.includes('*')) return true;
  return perms.some((p) => String(p).startsWith('platform.'));
}

export function hasPlatformPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  const perms = user.permissions || [];
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}

export function filterPlatformNav(user, items) {
  if (!user) return [];
  if (user.role === 'superadmin' || user.permissions?.includes('*')) return items;
  return items.filter((item) => !item.permission || hasPlatformPermission(user, item.permission));
}

export { PLATFORM_ROLES };
