import { Config, Effect } from 'effect';
import { v7 } from 'uuid';

export class AuthConfig extends Effect.Service<AuthConfig>()('AuthConfig', {
  effect: Effect.gen(function* () {
    return {
      authUrl: yield* Config.string('AUTH_URL'),
      tenantId: yield* Config.string('TENANT_ID').pipe(
        Config.withDefault(v7())
      ),
    };
  }),
}) {}
