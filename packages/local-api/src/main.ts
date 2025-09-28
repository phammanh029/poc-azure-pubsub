import { HttpApiBuilder, HttpMiddleware } from '@effect/platform';
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node';
import { Config, Effect, Layer } from 'effect';
import { createServer } from 'http';
import { Api } from './api';
import { EchoGroupLive } from './endpoints/echo-live';

const main = Effect.gen(function* () {
  const port = yield* Config.number('PORT').pipe(Config.withDefault(3000));
  const ApiLive = HttpApiBuilder.api(Api).pipe(Layer.provide(EchoGroupLive));

  const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
    Layer.provide(ApiLive),
    Layer.provide(
      NodeHttpServer.layer(createServer, {
        port: port,
      })
    )
  );

  console.log(`Server running on http://localhost:${port}`);
  Layer.launch(HttpLive).pipe(NodeRuntime.runMain);
});

Effect.runPromise(main).catch(console.error);
