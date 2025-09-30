import { HttpApiBuilder, HttpMiddleware } from '@effect/platform';
import { Effect, Layer } from 'effect';
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node';
import { createServer } from 'http';
import { AuthApiLive } from './endpoints/auth/auth-api-live';
import { EventsLive } from './endpoints/events/events-api-live';
import { Api } from './api';
import { ProxyLive } from './endpoints/proxy/proxy-api-live';
import { MainConfig } from './config/main-config';
import { WsService } from './services/WsService';

const main = Effect.gen(function* () {
  const { port } = yield* MainConfig;
  const wsService = yield* WsService;
  const apiLive = HttpApiBuilder.api(Api).pipe(
    Layer.provide([EventsLive, AuthApiLive, ProxyLive])
  );

  const httpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
    Layer.provide(apiLive),
    Layer.provide(
      NodeHttpServer.layer(createServer, {
        port: port,
      })
    )
  );
  Layer.launch(httpLive).pipe(NodeRuntime.runMain);
  console.log(`Proxy Server running on http://localhost:${port}`);
  yield* wsService.init();
}).pipe(Effect.provide([MainConfig.Default, WsService.Default]));

Effect.runPromise(main).catch(console.error);
