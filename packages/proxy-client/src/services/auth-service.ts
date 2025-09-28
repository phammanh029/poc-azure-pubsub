import { Effect, Either, Schema } from 'effect';
import { AuthConfig } from '../config/auth-config';
import { ParseError } from 'effect/ParseResult';

// auth response data schema validation
const AuthResponseSchema = Schema.Struct({
  endpoint: Schema.String,
  hub: Schema.String,
});

export class AuthService extends Effect.Service<AuthService>()('AuthService', {
  effect: Effect.gen(function* () {
    const authConfig = yield* AuthConfig;
    return {
      auth: () =>
        Effect.tryPromise({
          try: async () => {
            console.log('Calling auth endpoint', authConfig.authUrl);
            const response = await fetch(authConfig.authUrl, {
              method: 'GET',
              headers: {
                'x-tenant-id': authConfig.tenantId,
                accept: 'application/json',
              },
            });
            console.log('auth response', response);
            if (!response.ok)
              throw new Error(`Auth request failed: ${response.statusText}`);
            return response.json();
          },
          catch: (error) => {
            throw new Error(`Auth request failed: ${error}`);
          },
        }).pipe(Schema.decodeUnknownEither(AuthResponseSchema)),
    };
  }),
}) {}
