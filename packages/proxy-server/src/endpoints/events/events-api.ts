import { HttpApiEndpoint, HttpApiGroup } from '@effect/platform';
import { Schema } from 'effect';
import { TaggedError } from 'effect/Schema';

export class EventProxyError extends TaggedError<EventProxyError>(
  'EventProxyError'
)('EventProxyError', {
  message: Schema.String,
}) {}

class EventProxyRequest extends Schema.Class<EventProxyRequest>(
  'EventProxyRequest'
)({
  'webhook-request-origin': Schema.String,
}) {}

export class EventProxyOptionResponse extends Schema.Class<EventProxyOptionResponse>(
  'EventProxyOptionResponse'
)({
  headers: Schema.Struct({
    'WebHook-Allowed-Origin': Schema.String,
  }),
}) {}

export class EventProxyResponse extends Schema.Class<EventProxyResponse>(
  'EventProxyResponse'
)({}) {}

export class EventHttpApiGroup extends HttpApiGroup.make('events', {
  topLevel: true,
})
  .add(
    HttpApiEndpoint.post('post', '/events')
      .addError(EventProxyError)
      .setHeaders(EventProxyRequest)
      .addSuccess(EventProxyResponse)
  )
  .add(
    HttpApiEndpoint.options('options', '/events')
      .addError(EventProxyError)
      // validate the headers
      .setHeaders(EventProxyRequest)
      .addSuccess(EventProxyOptionResponse, { status: 204 })
  ) {}
