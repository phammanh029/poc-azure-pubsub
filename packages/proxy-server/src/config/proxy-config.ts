import { Config, Effect } from 'effect';
import { generateUUID } from '../data/protocol';

export interface ProxyServerConfig {
  port: number;
  podName: string;
  valkeyUrl: string;
  requestTimeoutMs: number;
  hubName: string;
  pubsubConnectionString: string;
}

export class ProxyConfigService extends Effect.Service<ProxyServerConfig>()(
  'ProxyConfigService',
  {
    effect: Effect.gen(function* () {
      return {
        podName: yield* Config.string('POD_NAME').pipe(
          Config.withDefault(generateUUID())
        ),
        port: yield* Config.number('PORT').pipe(Config.withDefault(8080)),
        valkeyUrl: yield* Config.string('REDIS_URL'),
        hubName: yield* Config.string('HUB_NAME').pipe(
          Config.withDefault('wawi')
        ),
        pubsubConnectionString: yield* Config.string(
          'PUBSUB_CONNECTION_STRING'
        ),
        requestTimeoutMs: yield* Config.number('REQUEST_TIMEOUT_MS').pipe(
          Config.withDefault(30_000)
        ),
      };
    }),
    dependencies: [],
  }
) {}
