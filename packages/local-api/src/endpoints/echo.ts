import { HttpApiEndpoint, HttpApiGroup } from '@effect/platform';
import { Schema } from 'effect';

export class TenantNotFound extends Schema.TaggedError<TenantNotFound>()(
  'TenantNotFound',
  {
    tenantId: Schema.String,
    message: Schema.optional(Schema.String),
  }
) {}

export class TenantInfo extends Schema.Class<TenantInfo>("TenantInfo")({
  id: Schema.String,
  name: Schema.String,
}) {}

export class EchoGroup extends HttpApiGroup.make('echo', {
  topLevel: true,
}).add(
  HttpApiEndpoint.get('echo', '/echo')
    .addError(TenantNotFound)
    .addSuccess(TenantInfo)
) {}
