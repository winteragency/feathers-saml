import { Application } from '@feathersjs/feathers';
import { SamlStrategy, SamlUser } from './strategy';
import { SamlSetupSettings } from './utils';
export { SamlSetupSettings, SamlStrategy, SamlUser };
export declare const setup: (options: SamlSetupSettings) => (app: Application<{}>) => void;
export declare const express: (settings?: Partial<SamlSetupSettings>) => (app: Application<{}>) => void;
export declare const expressSaml: (settings?: Partial<SamlSetupSettings>) => (app: Application<{}>) => void;
