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
import { BadRequest } from '@feathersjs/errors';
 
const debug = Debug('feathers-saml/express');

export default (options: SamlSetupSettings) => {
  return (feathersApp: Application) => {
    const { authService } = options;
    const app = feathersApp as ExpressApplication;
    const config = app.get(authService + 'Saml');

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
      sp.create_login_request_url(idp, config.loginRequestOptions ? config.loginRequestOptions : {}, async (err: Error, login_url: string, request_id: string) => {
        if (err != null) {
          return res.send(500);
        } 

        res.redirect(login_url);
      });
    });

    authApp.get('/metadata.xml', async (req, res) => {
      res.type('application/xml');
      res.send(sp.create_metadata());
    });

    authApp.post('/assert', async (req, res, next) => {
      const service = app.defaultAuthentication(authService);
      const [ strategy ] = service.getStrategies('saml') as SamlStrategy[];
      const params: any = {
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
          let loginResponseOptions: any = {};

          if (config.loginResponseOptions) {
            loginResponseOptions = config.loginResponseOptions;
          }
  
          loginResponseOptions.request_body = req.body;
          
          sp.post_assert(idp, loginResponseOptions, async (err: Error, saml_response: any) => {
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

        params.payload = {
          nameId: samlResponse && samlResponse.user && samlResponse.user.name_id ? samlResponse.user.name_id : null,
          sessionIndex: samlResponse && samlResponse.user && samlResponse.user.session_index ? samlResponse.user.session_index : null
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

    authApp.get('/logout', async (req, res, next) => {
      const { nameId, sessionIndex } = req.query;

      if (!nameId || !sessionIndex) {
        return next(new BadRequest('`nameId` and `sessionIndex` must be set in query params'));
      }
      
      let logoutRequestOptions: any = {};

      if (config.logoutRequestOptions) {
        logoutRequestOptions = config.logoutRequestOptions;
      }

      logoutRequestOptions.name_id = nameId;
      logoutRequestOptions.session_ndex = sessionIndex;

      sp.create_logout_request_url(idp, logoutRequestOptions, async (err: Error, logout_url: string) => {
        if (err != null) {
          next(err);
          return;
        }

        res.redirect(logout_url);
      });
    });

    authApp.get('/slo', async (req, res, next) => {
      sp.create_logout_response_url(idp, config.logoutResponseOptions ? config.logoutResponseOptions : {}, async (err: Error, request_url: string) => {
        if (err != null) {
          next(err);
          return;
        }

        res.redirect(request_url);
      });
    });


    app.use(path, authApp);
  };
};