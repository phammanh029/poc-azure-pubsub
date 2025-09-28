import { Effect } from 'effect';
import { ProxyConfigService } from '../config/proxy-config';
export class ConnectionService extends Effect.Service<ConnectionService>()(
  'ConnectionService',
  {
    effect: Effect.gen(function* () {
        const { podName, valkeyUrl } = yield* ProxyConfigService;
        return {};
    }),
  }
) {}
