import { HttpApiBuilder } from '@effect/platform';
import { Api } from '../api';
import { TenantInfo, TenantNotFound } from './echo';
import { Effect } from 'effect';

export const EchoGroupLive = HttpApiBuilder.group(Api, 'echo', (handlers) =>
  handlers.handle('echo', (req) => {
    const tenantId = req.request.headers['x-tenant-id'];
    if (!tenantId) {
      return Effect.fail(
        new TenantNotFound({
          tenantId: 'unknown',
          message: 'x-tenant-id header is required',
        })
      );
    }

    return Effect.succeed(
      new TenantInfo({
        id: tenantId,
        name: `Tenant ${tenantId}`,
      })
    );
  })
);
