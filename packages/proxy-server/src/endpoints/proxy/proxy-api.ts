import { HttpApiEndpoint, HttpApiGroup } from '@effect/platform';
import { Schema } from 'effect';

class ProxyApiResponse extends Schema.Class<ProxyApiResponse>(
  'ProxyApiResponse'
)({
  headers: Schema.Record({ key: Schema.String, value: Schema.String }),
  body: Schema.optional(Schema.String),
  status: Schema.Number,
}) {}

export class ProxyApiGroup extends HttpApiGroup.make('proxy', {
  topLevel: true,
}).add(
  HttpApiEndpoint.get('proxy-get', '/proxy').addSuccess(ProxyApiResponse)
) {}
