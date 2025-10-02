import {
  HttpApiEndpoint,
  HttpApiGroup,
} from '@effect/platform';
import { Schema } from 'effect';
import { TaggedError } from 'effect/Schema';
import { WPSError } from '../../services/WsService';

export class AuthApiSuccessResponse extends Schema.Class<AuthApiSuccessResponse>(
  'AuthApiSuccessResponse'
)({
  endpoint: Schema.String,
  hub: Schema.String,
}) {}

export class AuthApiErrorResponse extends TaggedError<AuthApiErrorResponse>(
  'AuthApiErrorResponse'
)('AuthApiErrorResponse', {}) {
    static fromWsError(error: WPSError) {
        return new AuthApiErrorResponse({ message: error.message });
    }
}

export class AuthApiHeaderSchema extends Schema.Class<AuthApiHeaderSchema>(
  'AuthApiHeaderSchema'
)({
  'x-tenant-id': Schema.String,
}) {}

export class AuthApiGroup extends HttpApiGroup.make('auth', {
  topLevel: true,
}).add(
  HttpApiEndpoint.get('auth', '/auth')
    .addSuccess(AuthApiSuccessResponse)
    .setHeaders(AuthApiHeaderSchema)
    .addError(AuthApiErrorResponse)
) {}
