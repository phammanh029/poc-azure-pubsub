import { HttpApi } from '@effect/platform';
import { EventHttpApiGroup } from './endpoints/events/events-api';
import { AuthApiGroup } from './endpoints/auth/auth-api';
import { ProxyApiGroup } from './endpoints/proxy/proxy-api';

export class Api extends HttpApi.make('proxy-api')
  .add(EventHttpApiGroup)
  .add(AuthApiGroup)
  .add(ProxyApiGroup) {}
