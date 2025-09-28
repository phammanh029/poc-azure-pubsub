import { HttpApiBuilder, HttpMiddleware } from '@effect/platform';
import { Layer } from 'effect';
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node';
import { createServer } from 'http';
import { AuthApiLive } from './endpoints/auth/auth-api-live';
import { EventsLive } from './endpoints/events/events-live';
import { Api } from './api';
import { ProxyLive } from './endpoints/proxy/proxy-live';

const apiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide([EventsLive, AuthApiLive, ProxyLive])
);

const httpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(apiLive),
  Layer.provide(
    NodeHttpServer.layer(createServer, {
      port: 3000,
    })
  )
);

console.log('Proxy Server running on http://localhost:3000');
Layer.launch(httpLive).pipe(NodeRuntime.runMain);
