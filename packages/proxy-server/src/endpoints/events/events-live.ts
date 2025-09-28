import { HttpApiBuilder } from '@effect/platform';
import { Effect, Layer } from 'effect';
import { Api } from '../../api';
import { ConnectionService } from '../../services/connection-service';
import { EventProxyError } from './events-api';
import { ProxyConfigService } from '../../config/proxy-config';

export const EventsLive = HttpApiBuilder.group(Api, 'events', (handlers) =>
  Effect.gen(function* () {
    const connectionService = yield* ConnectionService;
    const { podName } = yield* ProxyConfigService;
    return handlers
      .handle(
        'post',
        ({
          headers: {
            'ce-eventname': eventName,
            'ce-userid': userId,
            'ce-connectionid': connectionId,
          },
        }) =>
          Effect.gen(function* () {
            if (userId === podName) return {};

            yield* Effect.log(
              'Received post request',
              eventName,
              userId,
              connectionId
            );
            switch (eventName) {
              case 'connected':
                yield* connectionService.addConnection(userId, connectionId);
                break;
              case 'disconnected':
                yield* connectionService.removeConnection(userId);
                break;
            }
            // on connected, add to the storage
            return {};
          }).pipe(Effect.catchAll(EventProxyError.fromError))
      )
      .handle('options', (req) => {
        console.log('Received options request', req);
        return Effect.succeed({
          headers: {
            'WebHook-Allowed-Origin': '*',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': '*',
            Allow: 'GET, POST, OPTIONS',
          },
        });
      });
  })
).pipe(Layer.provide([ConnectionService.Default, ProxyConfigService.Default]));
