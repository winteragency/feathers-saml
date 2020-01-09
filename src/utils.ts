import { Application } from '@feathersjs/feathers';

export interface SamlSetupSettings {
  authService?: string;
}

export const getDefaultSettings = (_app: Application, other?: Partial<SamlSetupSettings>) => {
  const defaults: SamlSetupSettings = {
    ...other
  };

  return defaults;
};