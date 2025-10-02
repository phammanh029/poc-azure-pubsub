import { Effect, Either, Schema } from 'effect';
import { AuthConfig } from '../config/auth-config';

// auth response data schema validation
const AuthResponseSchema = Schema.Struct({
  endpoint: Schema.String,
  hub: Schema.String,
});

export class AuthService extends Effect.Service<AuthService>()('AuthService', {
  effect: Effect.gen(function* () {
    const { authUrl, tenantId } = yield* AuthConfig;
    return {
      auth: () =>
        Effect.gen(function* () {
          const responseData = yield* Effect.tryPromise(() =>
            fetch(authUrl, {
              method: 'GET',
              headers: {
                'x-tenant-id': tenantId,
                accept: 'application/json',
              },
            }).then((res) => res.json())
          );

          const decoded =
            Schema.decodeUnknownEither(AuthResponseSchema)(responseData);
          if (Either.isLeft(decoded)) {
            throw new Error('Invalid auth response');
          }
          return decoded.right;
        }),
    };
  }),
}) {}
