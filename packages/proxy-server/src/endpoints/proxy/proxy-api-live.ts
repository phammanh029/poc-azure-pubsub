import { HttpApiBuilder } from '@effect/platform';
import { Effect, Layer } from 'effect';
import { Api } from '../../api';
import { ConnectionService } from '../../services/connection-service';
import { ProxyNoConnectionError } from './proxy-api';
import { WsService } from '../../services/WsService';

export const ProxyLive = HttpApiBuilder.group(Api, 'proxy', (handlers) =>
  Effect.gen(function* () {
    const connectionService = yield* ConnectionService;
    const wsService = yield* WsService;
    return handlers.handle('get', ({ headers }) =>
      Effect.gen(function* () {
        // yield* Effect.log('Received proxy request', req);
        const tenantId = headers['x-tenant-id'];
        // retrieve the connection from redis
        const connectionId = yield* connectionService.getConnection(tenantId);
        if (!connectionId)
          throw new ProxyNoConnectionError({
            message: `No connection found for tenant: ${tenantId}`,
          });

        yield* Effect.log(`Found connection ${connectionId} for tenant ${tenantId}`);

        // send the message to the connection
        const clientResponse = yield* wsService.sendToClient(
          connectionId,
          tenantId,
          {
            headers,
            path: '/info',
            method: 'GET',
          }
        );
        yield* Effect.log('Received response from client', clientResponse);

        return {
          headers: { key: 'value' },
          body: 'Proxy response body',
          status: 200,
        };
      })
    );
  })
).pipe(Layer.provide([ConnectionService.Default, WsService.Default]));
