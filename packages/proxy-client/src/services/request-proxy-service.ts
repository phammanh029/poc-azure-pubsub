import { Effect } from 'effect';
import type { WebPubSubClient } from '@azure/web-pubsub-client';
import { SchemaRequestSchema } from '../schema/schema';

/**
 * This contains the proxy function where it will call the rest api from external endpoints and then send it back to the azure web pubsub group
 */
export class RequestProxyService extends Effect.Service<RequestProxyService>()(
  'RequestProxyService',
  {
    effect: Effect.gen(function* () {
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
