import { Effect, Schema } from "effect";
import type { WebPubSubClient } from "@azure/web-pubsub-client";
import { isLeft } from "effect/Either";

const ProxyRequestSchema = Schema.Struct({
  op: Schema.Literal("request"),
  data: Schema.Struct({
    method: Schema.Union(
      Schema.Literal("GET"),
      Schema.Literal("POST"),
      Schema.Literal("PUT"),
      Schema.Literal("DELETE")
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
  "RequestProxyService",
  {
    effect: Effect.gen(function* () {
      // TODO: load the config the server and then proxy the request
      return {
        proxy: (
          replyTo: string,
          input: unknown,
          messageSender: WebPubSubClient["sendToGroup"]
        ) =>
          Effect.gen(function* () {
            // decode and validate the request
            const decoded =
              Schema.decodeUnknownEither(ProxyRequestSchema)(input);
            if (isLeft(decoded)) {
              yield* Effect.logWarning(
                `Invalid proxy request received: ${JSON.stringify(
                  input
                )}, error: ${JSON.stringify(decoded.left)}`
              );
              // TODO: send back the error response
              messageSender(
                replyTo,
                {
                  status: 400,
                  body: { message: "Invalid request" },
                  headers: { "content-type": "application/json" },
                },
                "json",
                {
                  fireAndForget: true,
                }
              );
              return;
            }
            // handle the request
            const req = decoded.right;
            // call to the local api (mock for now)
            const response = {
              status: 200,
              body: { message: "Hello from local API" },
              headers: { "content-type": "application/json" },
            };
            yield* Effect.promise(() =>
              messageSender(replyTo, response, "json", {
                fireAndForget: true,
              })
            );
          }),
      };
    }),
  }
) {}
