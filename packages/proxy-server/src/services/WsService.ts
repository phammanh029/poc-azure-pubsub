import { WebPubSubServiceClient } from '@azure/web-pubsub';
import { GroupDataMessage, WebPubSubClient } from '@azure/web-pubsub-client';
import { Effect, Either, Schema } from 'effect';
import { TaggedError } from 'effect/Schema';
import { ProxyConfigService } from '../config/proxy-config';
import { RequestMessage } from '../data/protocol';

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
    catch: WPSError.from,
  }).pipe(Effect.catchAll(WPSError.from));

// in-memory pending request store
type PendingResolver = {
  resolve: (data: ClientResponseDataPayload) => void;
  reject: (err: any) => void;
  timeoutId: NodeJS.Timeout;
};
const pendingRequests = new Map<string, PendingResolver>();

export type GroupMessageReplyFn = (response: {
  replyTo: string;
  data: any;
}) => Effect.Effect<void, never, never>;

export type wsResponseFunction = (
  data: GroupDataMessage,
  reply: GroupMessageReplyFn
) => Effect.Effect<void, never, never>;

export class WsService extends Effect.Service<WsService>()('WsService', {
  effect: Effect.gen(function* () {
    const { hubName, pubsubConnectionString, podName, requestTimeoutMs } =
      yield* ProxyConfigService;
    yield* Effect.log('Initializing WsService', podName);
    const wspClient = new WebPubSubServiceClient(
      pubsubConnectionString,
      hubName
    );

    const chat = (groupName: string, connectionId?: string) =>
      Effect.gen(function* () {
        yield* Effect.log('Initializing chat for group', groupName);
        // get the access to the group
        const groupAccessToken = yield* wsPromise(() =>
          wspClient.getClientAccessToken({
            groups: [groupName],
            roles: [
              `webpubsub.joinLeaveGroup.${groupName}`,
              // if we need to send message to client, need to add sendToGroup role
            ],
            userId: podName,
            // will be expiring in 1 hour
            expirationTimeInMinutes: 60,
          })
        );
        const groupClient = new WebPubSubClient(groupAccessToken.url, {
          autoReconnect: true,
          autoRejoinGroups: true,
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

        return {
          start: (
            onReceived: (
              data: GroupDataMessage
            ) => Effect.Effect<void, never, never>
          ) =>
            Effect.gen(function* () {
              // re-register the handler
              groupClient.on('group-message', (msg) =>
                Effect.runPromise(onReceived(msg.message))
              );
              yield* wsPromise(() => groupClient.start());
            }),
          stop: () => Effect.sync(() => groupClient.stop()),
          send: reply,
        };
      });

    return {
      hubName: hubName,
      closeConnection: (connectionId: string, reason?: string) =>
        wsPromise(() =>
          wspClient.closeConnection(connectionId, {
            reason,
          })
        ),
      init: () =>
        Effect.gen(function* () {
          const resolveResponse = (data: unknown) =>
            Effect.gen(function* () {
              const decoded =
                Schema.decodeUnknownEither(ClientResponseSchema)(data);
              if (Either.isLeft(decoded)) {
                yield* Effect.logError(
                  `Failed to decode client response: ${JSON.stringify(
                    data
                  )}, error: ${decoded.left}`
                );
                return;
              }
              const { requestId, payload } = decoded.right;
              const resolver = pendingRequests.get(requestId);
              if (resolver) {
                resolver.resolve(payload);
                clearTimeout(resolver.timeoutId);
                pendingRequests.delete(requestId);
              } else {
                yield* Effect.logWarning('No pending resolver for', requestId);
              }
            });

          const onClientResponse = (data: GroupDataMessage) =>
            resolveResponse(data.data);

          const { start } = yield* chat(podName);
          yield* start(onClientResponse);
          yield* Effect.log('Pod listening to group ' + podName);
        }),
      auth: (clientId: string) =>
        Effect.gen(function* () {
          const token = yield* wsPromise(() =>
            wspClient.getClientAccessToken({
              roles: ['webpubsub.sendToGroup'],
              userId: clientId,
              expirationTimeInMinutes: 60,
            })
          );
          return {
            endpoint: token.url,
            hub: hubName,
          };
        }),
      // communicate with client via group, the callback will be triggered when client sends message back
      chat: chat,
      // send message to client
      sendToClient: (
        connectionId: string,
        message: RequestMessage,
        abortSignal?: AbortSignal
      ) =>
        Effect.async<ClientResponseDataPayload, WPSError>((resume) => {
          const requestId = message.id;
          // make sure the request will timeout after certain time
          const timeoutId = setTimeout(() => {
            const resolver = pendingRequests.get(requestId);
            if (resolver) {
              resolver.reject(
                new WPSError({
                  message: `Request ${requestId} timed out after ${requestTimeoutMs}ms`,
                })
              );
              pendingRequests.delete(requestId);
            }
          }, requestTimeoutMs);

          const resolver = {
            resolve: (data: ClientResponseDataPayload) =>
              resume(Effect.succeed(data)),
            reject: (err: WPSError) => resume(Effect.fail(err)),
            timeoutId,
          };
          pendingRequests.set(requestId, resolver);

          wspClient
            .sendToConnection(
              connectionId,
              {
                replyTo: podName,
                data: message,
              },
              {
                abortSignal,
              }
            )
            .catch((err) => resolver.reject(WPSError.from(err)));
        }),
    };
  }),
  dependencies: [ProxyConfigService.Default],
}) {}
