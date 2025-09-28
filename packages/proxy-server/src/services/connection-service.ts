import { Effect } from 'effect';
import { createClient } from 'redis';
import { ProxyConfigService } from '../config/proxy-config';
export class ConnectionService extends Effect.Service<ConnectionService>()(
  'ConnectionService',
  {
    effect: Effect.gen(function* () {
      const { podName, valkeyUrl } = yield* ProxyConfigService;
      // create redis client
      const redis = createClient({
        url: valkeyUrl,
      });
      yield* Effect.log(`Connecting to Redis at ${valkeyUrl}`);
      yield* Effect.tryPromise(() => redis.connect());
      yield* Effect.log(`Connected to Redis`);
      // function to add connection
      const addConnection = (tenantId: string, connectionId: string) =>
        Effect.gen(function* () {
          yield* Effect.log(
            `Adding connection ${connectionId} for tenant ${tenantId} in pod ${podName}`
          );
          yield* Effect.tryPromise(() => redis.set(tenantId, connectionId));
          yield* Effect.log(`Connection ${connectionId} added for tenant ${tenantId}`);
          return {};
        });
      // function to remove connection
      const removeConnection = (tenantId: string) =>
        Effect.gen(function* () {
          yield* Effect.log(
            `Removing connection for tenant ${tenantId} in pod ${podName}`
          );
          yield* Effect.tryPromise(() => redis.del(tenantId));
          yield* Effect.log(`Connection removed for tenant ${tenantId}`);
          return {};
        });
      // function to get connection
      const getConnection = (tenantId: string) =>
        Effect.gen(function* () {
          yield* Effect.log(
            `Getting connection for tenant ${tenantId} in pod ${podName}`
          );
          const connectionId = yield* Effect.tryPromise(() =>
            redis.get(tenantId)
          );
          if (!connectionId) {
            return undefined;
          }
          return connectionId;
        });

      return {
        addConnection,
        removeConnection,
        getConnection,
      };
    }),
    dependencies: [ProxyConfigService.Default],
  }
) {}
