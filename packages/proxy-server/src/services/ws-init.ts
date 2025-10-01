import { Effect } from 'effect';
import { WsService } from './WsService';

// Simple startup layer to initialize WsService once at app boot.
export class WsInit extends Effect.Service<WsInit>()('WsInit', {
  scoped: Effect.gen(function* () {
    const ws = yield* WsService;
    // Start the background listener for client responses
    yield* ws.init();
    return { ready: true } as const;
  }),
  dependencies: [WsService.Default],
}) {}

