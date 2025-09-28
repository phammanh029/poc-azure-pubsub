import {
  HttpApiEndpoint,
  HttpApiGroup,
} from '@effect/platform';
import { Schema } from 'effect';
import { TaggedError } from 'effect/Schema';

export class EventProxyError extends TaggedError<EventProxyError>(
  'EventProxyError'
)('EventProxyError', {
  message: Schema.String,
}) {}

export class EventProxyResponse extends Schema.Class<EventProxyResponse>(
  'EventProxyResponse'
)({}) {}

export class EventHttpApiGroup extends HttpApiGroup.make('events', {
  topLevel: true,
}).add(
  HttpApiEndpoint.post('events', '/events')
    .addError(EventProxyError)
    .addSuccess(EventProxyResponse)
) {}
