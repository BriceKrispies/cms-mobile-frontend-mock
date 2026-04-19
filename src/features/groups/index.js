import { registerFeature } from '../../app/registry.js';
import { nav } from './nav.js';
import { routes } from './routes.js';

registerFeature({ id: 'groups', nav, routes });
