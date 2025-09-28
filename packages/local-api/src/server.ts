import { HttpApiBuilder, HttpMiddleware } from '@effect/platform';
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node';
import { Layer } from 'effect';
import { createServer } from 'http';
import { Api } from './api';
import { EchoGroupLive } from './endpoints/echo-live';

const ApiLive = HttpApiBuilder.api(Api).pipe(Layer.provide(EchoGroupLive));

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(ApiLive),
  Layer.provide(
    NodeHttpServer.layer(createServer, {
      port: 3000,
    })
  )
);

console.log('Server running on http://localhost:3000');
Layer.launch(HttpLive).pipe(NodeRuntime.runMain);
