import { HttpApiEndpoint, HttpApiGroup } from '@effect/platform';
import { Schema } from 'effect';

export class ProxyApiResponse extends Schema.Class<ProxyApiResponse>(
  'ProxyApiResponse'
)({
  headers: Schema.Record({ key: Schema.String, value: Schema.String }),
  body: Schema.optional(Schema.String),
  status: Schema.Number,
}) {}

class ProxyApiHeader extends Schema.Class<ProxyApiHeader>('ProxyApiHeader')({
  'x-tenant-id': Schema.String,
}) {}

export class ProxyNoConnectionError extends Schema.Class<ProxyNoConnectionError>(
  'ProxyNoConnectionError'
)({
  message: Schema.String,
}) {}

export class ProxyUnknownError extends Schema.Class<ProxyUnknownError>(
  'ProxyUnknownError'
)({
  message: Schema.String,
}) {
  static fromError(error: unknown) {
    if (error instanceof ProxyUnknownError) {
      return error;
    }
    return new ProxyUnknownError({ message: String(error) });
  }
}

export class ProxyApiGroup extends HttpApiGroup.make('proxy', {
  topLevel: true,
}).add(
  HttpApiEndpoint.get('get', '/proxy')
    .addSuccess(ProxyApiResponse)
    .setHeaders(ProxyApiHeader)
    .addError(ProxyNoConnectionError, { status: 404 })
    .addError(ProxyUnknownError)
) {}
