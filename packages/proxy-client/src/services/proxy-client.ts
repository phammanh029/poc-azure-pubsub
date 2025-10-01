import { ServerDataMessage, WebPubSubClient } from "@azure/web-pubsub-client";
import { Effect, Either, Schema } from "effect";
import { AuthService } from "./auth-service";
import { RequestProxyService } from "./request-proxy-service";
import { ProxyRequestDataSchema } from "../schema/schema";
import { ChallengeService } from "./challenge-service";

export class ProxyClient extends Effect.Service<ProxyClient>()("ProxyClient", {
  effect: Effect.gen(function* () {
    const authService = yield* AuthService;
    const proxyService = yield* RequestProxyService;
    const challengeService = yield* ChallengeService;
    // call the auth endpoint to get the token
    const { endpoint } = yield* authService.auth();
    // connect using the awps sdk to the hub with the token
    const hubClient = new WebPubSubClient(endpoint, {
      autoReconnect: true,
    });

    const sendMessage = (replyTo: string, data: any) =>
      Effect.tryPromise(() =>
        hubClient.sendToGroup(replyTo, data, "json", { fireAndForget: true })
      ).pipe(
        Effect.catchTag("UnknownException", (err) => Effect.logError(err))
      );

    const serverMessageHandler = (msg: ServerDataMessage) =>
      Effect.gen(function* () {
        yield* Effect.logDebug(`Message received: ${JSON.stringify(msg.data)}`);
        // decode and validate the request
        const decoded = Schema.decodeUnknownEither(ProxyRequestDataSchema)(
          msg.data
        );
        if (Either.isLeft(decoded)) {
          yield* Effect.logWarning(
            `Invalid message received: ${JSON.stringify(
              msg.data
            )}, error: ${JSON.stringify(decoded.left)}`
          );
          return;
        }
        switch (decoded.right.data.op) {
          case "request":
            return yield* proxyService.proxy(
              decoded.right.replyTo,
              decoded.right.data,
              hubClient.sendToGroup
            );
          case "challenge":
            const challengeResponse =
              yield* challengeService.respondToChallenge(decoded.right.data);
            // send back to the server
            return yield* sendMessage(decoded.right.replyTo, challengeResponse);
        }
      });

    hubClient.on("server-message", (msg) =>
      Effect.runSync(serverMessageHandler(msg.message))
    );
    hubClient.on("group-message", (msg) =>
      Effect.runSync(
        Effect.logInfo(`Group message received: ${JSON.stringify(msg.message)}`)
      )
    );
    hubClient.on("connected", (ev) =>
      Effect.runSync(Effect.logInfo("Hub client connected", ev))
    );

    hubClient.on("disconnected", (ev) =>
      Effect.runSync(Effect.logInfo("Hub client disconnected", ev))
    );
    hubClient.on("stopped", (ev) =>
      Effect.runSync(Effect.logInfo("Hub client stopped", ev))
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
  dependencies: [
    RequestProxyService.Default,
    AuthService.Default,
    ChallengeService.Default,
  ],
}) {}
