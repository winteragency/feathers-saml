// @ts-ignore
import Debug from 'debug';
import { Application } from '@feathersjs/feathers';
import { AuthenticationResult } from '@feathersjs/authentication';
import {
  Application as ExpressApplication,
  original as express
} from '@feathersjs/express';
import { SamlSetupSettings } from './utils';
import { SamlStrategy } from './strategy';
 
const debug = Debug('feathers-saml/express');

export default (options: SamlSetupSettings) => {
  return (feathersApp: Application) => {
    const { authService } = options;
    const app = feathersApp as ExpressApplication;
    const config = app.get('saml');

    if (!config) {
      debug('No SAML configuration found, skipping Express SAML setup');
      return;
    }

    if (!config.sp) {
      debug('No SAML SP found, skipping Express SAML setup');
      return;
    }

    if (!config.idp) {
      debug('No SAML IdP found, skipping Express SAML setup');
      return;
    }

    const { sp, idp, path } = config;

    const authApp = express();
    
    authApp.get('/', async (req, res) => {
        sp.create_login_request_url(idp, {}, async (err: Error, login_url: string, request_id: string) => {
            if (err != null) {
              return res.send(500);
            } 

            res.redirect(login_url);
        });
    });

    authApp.post('/assert', async (req, res, next) => {
      const service = app.defaultAuthentication(authService);
      const [ strategy ] = service.getStrategies('saml') as SamlStrategy[];
      const params = {
        authStrategies: [ strategy.name ]
      };
      const sendResponse = async (data: AuthenticationResult|Error) => {
        try {
          const redirect = await strategy.getRedirect(data, params);

          if (redirect !== null) {
            res.redirect(redirect);
          } else if (data instanceof Error) {
            throw data;
          } else {
            res.json(data);
          }
        } catch (error) {
          debug('SAML error', error);
          next(error);
        }
      };

      try {
        const samlResponse: any = await new Promise((resolve, reject) => {
            sp.post_assert(idp, {
                request_body: req.body
            },
            async (err: Error, saml_response: any) => {
                if (err != null) {
                    reject(err);
                    return;
                }
            
                resolve(saml_response);
            });
        });

        const authentication = {
          strategy: strategy.name,
          ...samlResponse
        };

        debug(`Calling ${authService}.create authentication with SAML strategy`);

        const authResult = await service.create(authentication, params);

        debug('Successful SAML authentication, sending response');

        await sendResponse(authResult);
      } catch (error) {
        debug('Received SAML authentication error', error.stack);
        await sendResponse(error);
      }
    });

    // TODO: Implement logout. Need a way to get NameId and SessionIndex here.
    authApp.get('/logout', async (req, res, next) => {
        sp.create_logout_request_url(idp,  {
            name_id: null,
            session_index: null
        }, async (err: Error, logout_url: string) => {
            if (err != null) {
                next(err);
                return;
            }

            res.redirect(logout_url);
        });
    });

    app.use(path, authApp);
  };
};