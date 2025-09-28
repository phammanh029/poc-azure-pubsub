import { Effect, Schema } from 'effect';
import { ProxyConfigService } from '../config/proxy-config';
import { JSONTypes, WebPubSubServiceClient } from '@azure/web-pubsub';
import { WebPubSubClient } from '@azure/web-pubsub-client';
import { TaggedError } from 'effect/Schema';

class SuccessResponseSchema extends Schema.Struct({
  data: Schema.Any,
}) {}

class ErrorResponseSchema extends Schema.Struct({
  error: Schema.String,
}) {}

class ClientResponseSchema extends Schema.Struct({
  requestId: Schema.String,
  payload: Schema.Union(SuccessResponseSchema, ErrorResponseSchema),
}) {}

export class WPSError extends TaggedError<WPSError>()('WPSError', {
  message: Schema.optional(Schema.String),
}) {
  static from(err: unknown) {
    if (err instanceof WPSError) return err;
    return new WPSError({ message: (err as Error)?.message });
  }
}

const wsPromise = <T>(fn: Parameters<typeof Effect.tryPromise<T>>[0]) =>
  Effect.tryPromise({
    try: fn,
    catch: (err) => WPSError.from(err),
  }).pipe(Effect.catchAll(WPSError.from));

const makeKey = (clientId: string, requestId: string) =>
  `${clientId}::${requestId}`;
// in-memory pending request store
type PendingResolver = {
  resolve: (msg: any) => void;
  reject: (err: any) => void;
  timeoutId: NodeJS.Timeout;
};
const pendingRequests = new Map<string, PendingResolver>();

export class WsService extends Effect.Service<WsService>()('WsService', {
  effect: Effect.gen(function* () {
    yield* Effect.log('Initializing WsService');
    const { hubName, pubsubConnectionString, podName, requestTimeoutMs } =
      yield* ProxyConfigService;
    const wspClient = new WebPubSubServiceClient(
      pubsubConnectionString,
      hubName
    );

    return {
      hubName: hubName,
      init: () =>
        Effect.gen(function* () {
          // get the access to the group
          const groupAccessToken = yield* wsPromise(() =>
            wspClient.getClientAccessToken({
              groups: [podName],
              roles: [
                `webpubsub.joinLeaveGroup.${podName}`,
                // if we need to send message to client, need to add sendToGroup role
              ],
              userId: podName,
              // will be expiring in 60 minutes
              expirationTimeInMinutes: 60,
            })
          );
          const groupClient = new WebPubSubClient(groupAccessToken.url, {
            autoReconnect: true,
          });

          const resolveResponse = (data: unknown) =>
            Effect.gen(function* () {
              const { requestId, payload } = yield* Schema.decodeUnknown(
                ClientResponseSchema
              )(data);
              const key = makeKey(podName, requestId);
              const resolver = pendingRequests.get(key);
              if (resolver) {
                resolver.resolve(payload);
                clearTimeout(resolver.timeoutId);
                pendingRequests.delete(key);
              } else {
                console.warn('No pending resolver for', key);
              }
            });

          groupClient.on('group-message', async (msg) => {
            console.log('message from group', msg);
            if (msg.message.kind !== 'groupData') return;
            // handle both JSONTypes and ArrayBuffer
            let data: any;
            if (msg.message.data instanceof ArrayBuffer) {
              data = JSON.parse(Buffer.from(msg.message.data).toString('utf8'));
            } else {
              data = msg.message.data;
            }
            await Effect.runPromise(resolveResponse(data));
          });

          yield* wsPromise(() => groupClient.start());
          yield* wsPromise(() => groupClient.joinGroup(podName));
        }),
      auth: (clientId: string) =>
        Effect.gen(function* () {
          const token = yield* wsPromise(() =>
            wspClient.getClientAccessToken({
              roles: [
                `webpubsub.joinLeaveGroup.${hubName}`,
                'webpubsub.sendToGroup',
              ],
              userId: clientId,
              // will be expiring in 60 minutes
              expirationTimeInMinutes: 60,
            })
          );
          return {
            endpoint: token.url,
            hub: hubName,
          };
        }),

      // send message to client
      sendToClient: (
        connectionId: string,
        userId: string,
        message: string | JSONTypes | Buffer,
        abortSignal?: AbortSignal
      ) =>
        Effect.async<ClientResponseSchema, WPSError>((resume) => {
          const requestId = crypto.randomUUID();
          const key = makeKey(userId, requestId);
          // make sure the request will timeout after certain time
          const timeoutId = setTimeout(() => {
            const resolver = pendingRequests.get(key);
            if (resolver) {
              resolver.reject(
                new WPSError({
                  message: `Request ${requestId} timed out after ${requestTimeoutMs}ms`,
                })
              );
              pendingRequests.delete(key);
            }
          }, requestTimeoutMs);

          const resolver = {
            resolve: (data: ClientResponseSchema) =>
              resume(Effect.succeed(data)),
            reject: (err: WPSError) => resume(Effect.fail(err)),
            timeoutId,
          };
          pendingRequests.set(key, resolver);

          wspClient
            .sendToConnection(connectionId, message, {
              abortSignal,
            })
            .catch((err) => resolver.reject(WPSError.from(err)));
        }),
    };
  }),
  dependencies: [ProxyConfigService.Default],
}) {}
