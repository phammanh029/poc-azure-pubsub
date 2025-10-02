import { HttpApiBuilder, HttpServerResponse } from '@effect/platform';
import { Effect, Layer } from 'effect';
import { Api } from '../../api';
import { ProxyConfigService } from '../../config/proxy-config';
import { ChallengeService } from '../../services/challenge-service';
import { ConnectionService } from '../../services/connection-service';
import { EventProxyError } from './events-api';

export const EventsLive = HttpApiBuilder.group(Api, 'events', (handlers) =>
  Effect.gen(function* () {
    const challengeService = yield* ChallengeService;
    const connectionService = yield* ConnectionService;
    const { podName } = yield* ProxyConfigService;

    const optionHandler = Effect.gen(function* () {
      return HttpServerResponse.setHeaders({
        'WebHook-Allowed-Origin': '*',
      })(HttpServerResponse.empty());
    });

    const addConnection = (connectionInfo: {
      tenantId: string;
      connectionId: string;
    }) =>
      connectionService
        .addConnection(connectionInfo.tenantId, connectionInfo.connectionId)
        .pipe(
          Effect.catchTag('UnknownException', (e) =>
            Effect.gen(function* () {
              yield* Effect.logError(
                `Failed to add connection ${connectionInfo.connectionId} for tenant ${connectionInfo.tenantId}: ${e.message}`
              );
            })
          )
        );

    return handlers
      .handle('post', ({ headers }) =>
        Effect.gen(function* () {
          const {
            'ce-eventname': eventName,
            'ce-userid': userId,
            'ce-connectionid': connectionId,
          } = headers;
          if (userId === podName) return;

          yield* Effect.log(
            'Received post request',
            eventName,
            userId,
            connectionId,
            JSON.stringify(headers)
          );
          switch (eventName) {
            case 'ping':
              yield* Effect.log('Ping event from connection', connectionId);
              // add connection
              yield* addConnection({
                tenantId: userId.toString(),
                connectionId,
              });
              break;
            case 'connected':
              yield* challengeService.start(
                userId,
                connectionId,
                (connectionInfo) =>
                  Effect.gen(function* () {
                    yield* Effect.log(
                      'Challenge succeeded for connection ' +
                        connectionInfo.connectionId
                    );
                    yield* addConnection(connectionInfo);
                  }),
                (connectionInfo, reason) =>
                  Effect.gen(function* () {
                    yield* Effect.log(
                      `Challenge failed for connection ${connectionInfo.connectionId}: ${reason}`
                    );
                    yield* connectionService
                      .removeConnection(connectionInfo.connectionId)
                      .pipe(
                        Effect.catchTag('UnknownException', (e) =>
                          Effect.gen(function* () {
                            yield* Effect.logError(
                              `Failed to remove connection ${connectionInfo.connectionId} for tenant ${connectionInfo.tenantId}: ${e.message}`
                            );
                          })
                        )
                      );
                  })
              );
              break;
            case 'disconnected':
              // TODO: enable this once we found the issue with client disconnected
              // yield* connectionService.removeConnection(userId);
              break;
          }
        }).pipe(Effect.catchAll(EventProxyError.fromError))
      )
      .handle('options', () => optionHandler);
  })
).pipe(
  Layer.provide([
    ChallengeService.Default,
    ConnectionService.Default,
    ProxyConfigService.Default,
  ])
);
