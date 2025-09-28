import { HttpApiBuilder } from '@effect/platform';
import { Effect } from 'effect';
import { Api } from '../../api';

export const EventsLive = HttpApiBuilder.group(Api, 'events', (handlers) =>
  Effect.gen(function* () {
    return handlers.handle('events', (req) => {
      console.log('Received events request', req);
      return Effect.succeed({});
    });
  })
);
