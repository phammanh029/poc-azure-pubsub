import { Effect, Schema } from 'effect';
import type { WebPubSubClient } from '@azure/web-pubsub-client';
import { isLeft } from 'effect/Either';
import { SchemaRequestSchema } from '../schema/schema';

const ProxyRequestSchema = Schema.Struct({
  requestId: Schema.String,
  op: Schema.Literal('request'),
  data: Schema.Struct({
    method: Schema.Union(
      Schema.Literal('GET'),
      Schema.Literal('POST'),
      Schema.Literal('PUT'),
      Schema.Literal('DELETE')
    ),
    path: Schema.String,
    headers: Schema.Record({
      key: Schema.String,
      value: Schema.String,
    }),
    query: Schema.optional(Schema.String),
    body: Schema.optional(Schema.Any),
  }),
});

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
          replyTo: string,
          input: SchemaRequestSchema,
          messageSender: WebPubSubClient['sendToGroup']
        ) =>
          Effect.gen(function* () {
            // call to the local api (mock for now)
            const response = {
              status: 200,
              body: input,
              headers: { 'content-type': 'application/json' },
            };
            yield* Effect.promise(() =>
              messageSender(
                replyTo,
                {
                  requestId: input.id,
                  payload: {
                    data: response,
                  },
                },
                'json',
                {
                  fireAndForget: true,
                }
              )
            );
          }),
      };
    }),
  }
) {}
