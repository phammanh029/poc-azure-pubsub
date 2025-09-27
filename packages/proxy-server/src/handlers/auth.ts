import { Effect } from 'effect';
import { WebPubSubServiceClient } from '@azure/web-pubsub';
import { ProxyConfigService } from '../config';
import { json } from '../utils';

export const makeAuthHandler = Effect.gen(function* () {
  const config = yield* ProxyConfigService;

  const svc = new WebPubSubServiceClient(
    config.pubsubConnectionString,
    config.hubName
  );

  return (req: Request) =>
    Effect.gen(function* () {
      const clientId = req.headers.get('x-client-id');
      if (!clientId) return json({ error: 'clientId is required' }, 400);
      // get the client access token
      const token = yield* Effect.tryPromise(() =>
        svc.getClientAccessToken({
          roles: [
            `webpubsub.joinLeaveGroup.${config.hubName}`,
            'webpubsub.sendToGroup',
          ],
          userId: clientId,
          expirationTimeInMinutes: 60,
        })
      );
      if (!token?.url)
        return json({ error: 'Failed to mint access token' }, 502);
      return json({
        hub: config.hubName,
        endpoint: token.url,
      });
    });
});
