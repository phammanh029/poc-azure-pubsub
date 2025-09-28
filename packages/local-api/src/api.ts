import { HttpApi } from '@effect/platform';
import { EchoGroup } from './endpoints/echo';
export class Api extends HttpApi.make('local-api').add(EchoGroup) {}
