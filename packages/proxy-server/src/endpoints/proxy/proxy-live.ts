import { HttpApiBuilder } from '@effect/platform';
import { Api } from '../../api';
import { Effect } from 'effect';

export const ProxyLive = HttpApiBuilder.group(Api, 'proxy', (handlers) =>
  Effect.gen(function* () {
    return handlers.handle('proxy-get', (req) => {
      console.log('Received proxy request', req);
      return Effect.succeed({
        headers: { key: 'value' },
        body: 'Proxy response body',
        status: 200,
      });
    });
  })
);
