import { HttpApiBuilder } from '@effect/platform';
import { Effect, Layer } from 'effect';
import { Api } from '../../api';
import { WsService } from '../../services/WsService';
import { AuthApiErrorResponse } from './auth-api';

export const AuthApiLive = HttpApiBuilder.group(Api, 'auth', (handlers) =>
  Effect.gen(function* () {
    const wsService = yield* WsService;

    return handlers.handle('auth', ({ headers: { 'x-tenant-id': tenantId } }) =>
      wsService
        .auth(tenantId)
        .pipe(Effect.mapError(AuthApiErrorResponse.fromWsError))
    );
  })
);
