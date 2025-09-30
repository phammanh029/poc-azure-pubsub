import { HttpApiEndpoint, HttpApiGroup, HttpMiddleware } from '@effect/platform';
import { Effect, Schema } from 'effect';
import { TaggedError } from 'effect/Schema';
import { lowercaseUUID } from '../../schema/uuid';

export class EventProxyError extends TaggedError<EventProxyError>(
  'EventProxyError'
)('EventProxyError', {
  message: Schema.String,
}) {
  static fromError(error: unknown) {
    if (error instanceof EventProxyError) {
      return error;
    }
    return new EventProxyError({ message: String(error) });
  }
}

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

class EventProxySystemEvent extends Schema.Class<EventProxySystemEvent>(
  'EventProxySystemEvent'
)({
  'ce-time': Schema.String,
  'ce-connectionid': Schema.String,
  'ce-eventname': Schema.Union(
    Schema.Literal('connected'),
    Schema.Literal('disconnected')
  ),
  'ce-userid': lowercaseUUID,
}) {}

export class EventHttpApiGroup extends HttpApiGroup.make('events', {
  topLevel: true,
})
  .add(
    HttpApiEndpoint.post('post', '/events')
      .addError(EventProxyError)
      .setHeaders(EventProxySystemEvent)
      .addSuccess(EventProxyResponse)
  )
  .add(
    HttpApiEndpoint.options('options', '/events')
      .addError(EventProxyError)
      // validate the headers
      .setHeaders(EventProxyRequest)
      .addSuccess(EventProxyOptionResponse, { status: 200 })
  ) {}
