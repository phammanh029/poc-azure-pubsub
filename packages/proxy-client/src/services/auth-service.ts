import { Effect, Schema } from 'effect';
import { AuthConfig } from '../config/auth-config';

// auth response data schema validation
const AuthResponseSchema = Schema.Struct({
  endpoint: Schema.String,
  hub: Schema.String,
});

export class AuthService extends Effect.Service<AuthService>()('AuthService', {
  effect: Effect.gen(function* () {
    const authConfig = yield* AuthConfig;
    return {
      auth: () => Effect.tryPromise(() =>
        fetch(authConfig.authUrl, {
          method: 'GET',
          headers: {
            'x-tentant-id': authConfig.tenantId,
          },
        })
      ).pipe(Schema.decodeUnknownEither(AuthResponseSchema)),
    };
  }),
}) {}
