import { Config, Effect } from 'effect';

export class MainConfig extends Effect.Service<MainConfig>()('MainConfig', {
  effect: Effect.gen(function* () {
    return {
      port: yield* Config.number('PORT').pipe(Config.withDefault(3000)),
    };
  }),
}) {}
