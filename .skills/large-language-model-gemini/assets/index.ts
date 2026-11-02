import {createHandler} from './server.mjs';
import modelConfig from './model-config.json' with {type: 'json'};
// Follow the existing overseas Large Language Model integration:
// the platform resolves the API-ID annotated endpoint in server.mjs;
// only the existing platform credential is read from the environment.
Deno.serve(createHandler({
  getKey: () => Deno.env.get('INTEGRATIONS_API_KEY'),
  modelConfig,
}));