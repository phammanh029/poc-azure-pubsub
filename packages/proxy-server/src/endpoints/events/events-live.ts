import { HttpApiBuilder } from '@effect/platform';
import { Effect } from 'effect';
import { Api } from '../../api';

export const EventsLive = HttpApiBuilder.group(Api, 'events', (handlers) =>
  Effect.gen(function* () {
    return handlers
      .handle('post', (req) => {
        console.log('Received post request', req);
        return Effect.succeed({});
      })
      .handle('options', (req) => {
        console.log('Received options request', req);
        return Effect.succeed({
          headers: {
            'WebHook-Allowed-Origin': '*',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': '*',
          },
        });
      });
  })
);
