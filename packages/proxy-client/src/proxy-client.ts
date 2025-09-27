import { Effect } from 'effect';
import { RequestProxyService } from './services/request-proxy-service';
import { AuthService } from './services/auth-service';
import { WebPubSubClient } from '@azure/web-pubsub-client';

export class ProxyClient extends Effect.Service<ProxyClient>()('ProxyClient', {
  effect: Effect.gen(function* () {
    const authService = yield* AuthService;
    // call the auth endpoint to get the token
    const { endpoint } = yield* authService.auth();
    // connect using the awps sdk to the hub with the token
    const hubClient = new WebPubSubClient(endpoint, {
      autoReconnect: true,
    });
    hubClient.on('server-message', (msg) => {
      console.log('message from server', msg);
    });

    return {
      /**
       * Start the service
       */
      start: Effect.tryPromise(() => hubClient.start()),
      /**
       * Stop the service
       */
      stop: Effect.sync(() => hubClient.stop()),
    };
  }),
  dependencies: [RequestProxyService.Default],
}) {}
