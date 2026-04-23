import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  tenantId: string;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();

export const runWithTenant = <T>(tenantId: string, fn: () => Promise<T> | T): Promise<T> | T =>
  tenantContext.run({ tenantId }, fn);

export const getCurrentTenantId = (): string | undefined => tenantContext.getStore()?.tenantId;
