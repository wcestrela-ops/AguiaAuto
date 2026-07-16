import { timingSafeEqual } from 'crypto';

export function secretsMatch(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] || fallback || '';
  const isProd = process.env.NODE_ENV === 'production';

  if (!value && isProd) {
    throw new Error(`Variável obrigatória ausente em produção: ${name}`);
  }

  if (isProd && fallback && value === fallback) {
    throw new Error(`Variável ${name} não pode usar valor padrão de desenvolvimento em produção.`);
  }

  return value;
}

export function validateSmsHubEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const jwtSecret = process.env.SMS_HUB_JWT_SECRET;

  if (isProd && !jwtSecret) {
    throw new Error('SMS_HUB_JWT_SECRET é obrigatório em produção.');
  }

  if (isProd && jwtSecret === 'dev-secret-change-me') {
    throw new Error('SMS_HUB_JWT_SECRET não pode ser o valor padrão de desenvolvimento.');
  }

  if (isProd && !process.env.AGUIA_SERVICE_SECRET) {
    throw new Error('AGUIA_SERVICE_SECRET é obrigatório em produção (separado do ADMIN_SECRET).');
  }

  if (
    isProd &&
    process.env.AGUIA_SERVICE_SECRET &&
    process.env.AGUIA_ADMIN_SECRET &&
    process.env.AGUIA_SERVICE_SECRET === process.env.AGUIA_ADMIN_SECRET
  ) {
    throw new Error('AGUIA_SERVICE_SECRET e AGUIA_ADMIN_SECRET devem ser valores distintos em produção.');
  }
}
