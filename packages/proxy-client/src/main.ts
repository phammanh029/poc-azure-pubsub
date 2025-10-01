import { Effect } from "effect";
import { AuthConfig } from "./config/auth-config";
import { ProxyClient } from "./services/proxy-client";
import { AuthService } from "./services/auth-service";

const main = Effect.gen(function* () {
  const proxyClient = yield* ProxyClient;
  // yield* Effect.ensuring(proxyClient.stop)(proxyClient.start).pipe(Effect.scoped);
  const abortController = new AbortController();
  // abort if more than 1 minute
  setTimeout(() => abortController.abort(), 60 * 1000);
  yield* proxyClient.start(abortController.signal);
  yield* Effect.log("Proxy client started");
}).pipe(Effect.catchAll((err) => Effect.logError(err)));

const appLive = main.pipe(
  Effect.provide(ProxyClient.Default),
  Effect.provide(AuthService.Default),
  Effect.provide(AuthConfig.Default)
);

Effect.runPromise(appLive);
