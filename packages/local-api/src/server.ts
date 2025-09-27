import { HttpApi, HttpApiBuilder, HttpMiddleware } from '@effect/platform';
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node';
import { Layer, Effect } from 'effect';
import { createServer } from 'http';
import { EchoGroup, TenantInfo, TenantNotFound } from './echo';

const api = HttpApi.make('api').add(EchoGroup);

const EchoGroupLive = HttpApiBuilder.group(api, 'echo', (handlers) =>
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
const ApiLive = HttpApiBuilder.api(api).pipe(Layer.provide(EchoGroupLive));

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(ApiLive),
  Layer.provide(
    NodeHttpServer.layer(createServer, {
      port: 3000,
    })
  )
);

console.log('Server running on http://localhost:3000');
Layer.launch(HttpLive).pipe(NodeRuntime.runMain);
