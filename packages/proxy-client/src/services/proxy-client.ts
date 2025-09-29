import { WebPubSubClient } from "@azure/web-pubsub-client";
import { Effect } from "effect";
import { AuthService } from "./auth-service";
import { RequestProxyService } from "./request-proxy-service";

export class ProxyClient extends Effect.Service<ProxyClient>()("ProxyClient", {
  effect: Effect.gen(function* () {
    const authService = yield* AuthService;
    const proxyService = yield* RequestProxyService;
    // call the auth endpoint to get the token
    const { endpoint } = yield* authService.auth();
    // connect using the awps sdk to the hub with the token
    const hubClient = new WebPubSubClient(endpoint, {
      autoReconnect: true,
    });

    hubClient.on("server-message", (msg) =>
      Effect.runPromise(
        proxyService.proxy(msg.message.data, hubClient.sendToGroup)
      )
    );

    return {
      /**
       * Start the service
       */
      start: (abortSignal?: AbortSignal) =>
        Effect.tryPromise(() =>
          hubClient.start({
            abortSignal,
          })
        ),
      /**
       * Stop the service
       */
      stop: Effect.sync(() => hubClient.stop()),
    };
  }),
  dependencies: [RequestProxyService.Default, AuthService.Default],
}) {}
