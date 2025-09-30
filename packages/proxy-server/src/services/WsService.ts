import { Effect, Schema } from 'effect';
import { ProxyConfigService } from '../config/proxy-config';
import { JSONTypes, WebPubSubServiceClient } from '@azure/web-pubsub';
import { GroupDataMessage, WebPubSubClient } from '@azure/web-pubsub-client';
import { TaggedError } from 'effect/Schema';
import { DownstreamMessage } from '../data/protocol';

const SuccessResponseSchema = Schema.Struct({
  data: Schema.Any,
});

const ErrorResponseSchema = Schema.Struct({
  error: Schema.String,
});

const ClientResponseSchema = Schema.Struct({
  requestId: Schema.String,
  payload: Schema.Union(SuccessResponseSchema, ErrorResponseSchema),
});

type ClientResponseData = Schema.Schema.Type<typeof ClientResponseSchema>;
type ClientResponseDataPayload = ClientResponseData['payload'];

const ClientProxyRequestSchema = Schema.Struct({
  replyTo: Schema.String,
  data: Schema.Any,
});
export type ClientProxyRequestSchema = Schema.Schema.Type<
  typeof ClientProxyRequestSchema
>;

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
  `${clientId}:${requestId}`;
// in-memory pending request store
type PendingResolver = {
  resolve: (data: ClientResponseDataPayload) => void;
  reject: (err: any) => void;
  timeoutId: NodeJS.Timeout;
};
const pendingRequests = new Map<string, PendingResolver>();

export type GroupMessageReplyFn = (
  response: {
    replyTo: string;
    data: any
  }
) => Effect.Effect<void, never, never>;

export type wsResponseFunction = (
  data: GroupDataMessage,
  reply: GroupMessageReplyFn
) => Effect.Effect<void, never, never>;

export class WsService extends Effect.Service<WsService>()('WsService', {
  effect: Effect.gen(function* () {
    yield* Effect.log('Initializing WsService');
    const { hubName, pubsubConnectionString, podName, requestTimeoutMs } =
      yield* ProxyConfigService;
    const wspClient = new WebPubSubServiceClient(
      pubsubConnectionString,
      hubName
    );

    const directCommunicate = (
      groupName: string,
      onClientResponse: (
        data: GroupDataMessage,
        reply: GroupMessageReplyFn
      ) => Effect.Effect<unknown, unknown>,
      connectionId?: string
    ) =>
      Effect.gen(function* () {
        // get the access to the group
        const groupAccessToken = yield* wsPromise(() =>
          wspClient.getClientAccessToken({
            groups: [groupName],
            roles: [
              `webpubsub.joinLeaveGroup.${groupName}`,
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

        const reply = (message: any) =>
          connectionId != null
            ? wsPromise(() =>
                wspClient.sendToConnection(connectionId, message)
              ).pipe(
                Effect.catchAll((err) =>
                  Effect.gen(function* () {
                    yield* Effect.logError(
                      `Failed to send message to connection ${connectionId}: ${err}`
                    );
                  })
                )
              )
            : Effect.void;

        groupClient.on('group-message', (msg) =>
          Effect.runPromise(onClientResponse(msg.message, reply))
        );

        yield* wsPromise(() => groupClient.start());
        yield* wsPromise(() => groupClient.joinGroup(podName));
        return {
          stop: () => Effect.sync(() => groupClient.stop()),
          send: reply,
        };
      });

    return {
      hubName: hubName,
      closeConnection: (connectionId: string) =>
        wsPromise(() => wspClient.closeConnection(connectionId)),
      init: () =>
        Effect.gen(function* () {
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

          const onClientResponse = (
            data: GroupDataMessage,
            reply: GroupMessageReplyFn
          ) => resolveResponse(data.data);

          yield* directCommunicate(podName, onClientResponse);
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
      // communicate with client via group, the callback will be triggered when client sends message back
      communicate: directCommunicate,
      // send message to client
      sendToClient: (
        connectionId: string,
        userId: string,
        message: ClientProxyRequestSchema,
        abortSignal?: AbortSignal
      ) =>
        Effect.async<ClientResponseDataPayload, WPSError>((resume) => {
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
            resolve: (data: ClientResponseDataPayload) =>
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
