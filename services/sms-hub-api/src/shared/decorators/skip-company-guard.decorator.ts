import { SetMetadata } from '@nestjs/common';

export const SKIP_COMPANY_GUARD = 'skipCompanyGuard';
export const SkipCompanyGuard = () => SetMetadata(SKIP_COMPANY_GUARD, true);
