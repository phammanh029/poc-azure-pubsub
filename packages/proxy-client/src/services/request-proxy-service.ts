import { Effect, Schema } from 'effect';
import type { WebPubSubClient } from '@azure/web-pubsub-client';

export class ProxyRequestSchema extends Schema.Class<ProxyRequestSchema>(
  'ProxyRequestSchema'
)({
  method: Schema.Union(Schema.Literal('GET'), Schema.Literal('POST')),
  path: Schema.String,
  headers: Schema.Record({
    key: Schema.String,
    value: Schema.String,
  }),
  // where should the client send the response back to
  responseGroup: Schema.String,
  body: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.String,
    })
  ),
}) {}

/**
 * This contains the proxy function where it will call the rest api from external endpoints and then send it back to the azure web pubsub group
 */
export class RequestProxyService extends Effect.Service<RequestProxyService>()(
  'RequestProxyService',
  {
    effect: Effect.gen(function* () {
        // TODO: load the config the server and then proxy the request
      return {
        proxy: (
          req: ProxyRequestSchema,
          messageSender: WebPubSubClient['sendToGroup']
        ) =>
          Effect.gen(function* () {
            // call to the local api (mock for now)
            const response = {
              status: 200,
              body: { message: 'Hello from local API' },
              headers: { 'content-type': 'application/json' },
            };
            yield* Effect.promise(() =>
              messageSender(req.responseGroup, response, 'json', {
                fireAndForget: true,
              })
            );
          }),
      };
    }),
  }
) {}
