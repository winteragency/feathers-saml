import Debug from 'debug';
import { Application } from '@feathersjs/feathers';
import { SamlStrategy, SamlUser } from './strategy';
import { default as setupExpress } from './express';
import { SamlSetupSettings, getDefaultSettings } from './utils';
import { default as saml2 } from 'saml2-js';
import { default as fs } from 'fs';

const debug = Debug('feathers-saml');

export { SamlSetupSettings, SamlStrategy, SamlUser };

export const setup = (options: SamlSetupSettings) => (app: Application) => {
  const service = app.defaultAuthentication ? app.defaultAuthentication(options.authService) : null;

  if (!service) {
    throw new Error('An authentication service must exist before registering feathers-saml');
  }

  const { saml } = service.configuration;

  if (!saml || !saml.sp || !saml.idp) {
    debug(`No SAML configuration found in authentication configuration. Skipping SAML setup.`);
    return;
  }

  if (!saml.sp.private_key || !saml.sp.certificate) {
    throw new Error(`A private key path and certificate path must be provided in the SAML SP config. Skipping SAML setup.`);
  }

  if (!saml.idp.certificates) {
    throw new Error(`One or more trusted certificate paths must be provided in the SAML IdP config. Skipping SAML setup.`);
  }

    debug(`Creating  SAML SP`);
    const sp = new saml2.ServiceProvider({
        ...saml.sp,
        private_key: fs.readFileSync(saml.sp.private_key).toString(),
        certificate: fs.readFileSync(saml.sp.certificate).toString()
    });
    
    debug(`Creating  SAML IdP`);
    const idp = new saml2.IdentityProvider({
        ...saml.idp,
        certificates: saml.idp.certificates.map((certificate: string) => fs.readFileSync(certificate).toString())
    });

  debug(`Setting app global SAML object`);
  app.set('saml', {
      ...saml,
      path: saml.path ? saml.path : '/saml',
      sp: sp,
      idp: idp
  });
};

export const express = (settings: Partial<SamlSetupSettings> = {}) => (app: Application) => {
  const options = getDefaultSettings(app, settings);

  app.configure(setup(options));
  app.configure(setupExpress(options));
};

export const expressSaml = express;