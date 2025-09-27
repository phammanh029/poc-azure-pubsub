import { Effect, Layer } from 'effect';
import { ProxyClient } from './proxy-client';
import { AuthService } from './services/auth-service';
import { AuthConfig } from './config/auth-config';

const main = Effect.gen(function* () {
  const proxyClient = yield* ProxyClient;
  yield* Effect.log('Starting proxy client...');
  yield* Effect.ensuring(proxyClient.stop)(proxyClient.start);
  yield* Effect.log('Proxy client started');
}).pipe(Effect.catchAll((err) => Effect.logError(err)));

const appLive = main.pipe(
  Effect.provide(ProxyClient.Default),
  Effect.provide(AuthService.Default),
  Effect.provide(AuthConfig.Default)
);

Effect.runPromise(appLive);
