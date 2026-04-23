import { Prisma } from '@prisma/client';

import { getCurrentTenantId } from './tenant-context';

const TENANT_SCOPED_MODELS = new Set<string>(['User']);

const SKIP_TENANT_INJECT = '__skipTenant';

type ArgsWithWhere = { where?: Record<string, unknown>; data?: unknown; [k: string]: unknown };

const injectWhere = (args: ArgsWithWhere, tenantId: string): ArgsWithWhere => {
  const where = args.where ?? {};
  if ('tenantId' in where) return args;
  return { ...args, where: { ...where, tenantId } };
};

const injectData = (args: ArgsWithWhere, tenantId: string): ArgsWithWhere => {
  const data = args.data as Record<string, unknown> | Array<Record<string, unknown>> | undefined;
  if (!data) return args;
  if (Array.isArray(data)) {
    return {
      ...args,
      data: data.map((row) => ('tenantId' in row ? row : { ...row, tenantId })),
    };
  }
  if ('tenantId' in data) return args;
  return { ...args, data: { ...data, tenantId } };
};

export const withTenantExtension = () =>
  Prisma.defineExtension({
    name: 'withTenant',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_SCOPED_MODELS.has(model)) return query(args);

          const a = (args ?? {}) as ArgsWithWhere & { [SKIP_TENANT_INJECT]?: boolean };
          if (a[SKIP_TENANT_INJECT]) {
            const { [SKIP_TENANT_INJECT]: _skip, ...clean } = a;
            return query(clean);
          }

          const tenantId = getCurrentTenantId();
          if (!tenantId) return query(args);

          switch (operation) {
            case 'findUnique':
            case 'findUniqueOrThrow':
            case 'findFirst':
            case 'findFirstOrThrow':
            case 'findMany':
            case 'count':
            case 'aggregate':
            case 'groupBy':
            case 'update':
            case 'updateMany':
            case 'delete':
            case 'deleteMany':
              return query(injectWhere(a, tenantId));
            case 'create':
            case 'createMany':
            case 'upsert':
              return query(injectData(a, tenantId));
            default:
              return query(args);
          }
        },
      },
    },
  });
