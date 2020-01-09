import { Application } from '@feathersjs/feathers';
export interface SamlSetupSettings {
    authService?: string;
}
export declare const getDefaultSettings: (_app: Application<{}>, other?: Partial<SamlSetupSettings>) => SamlSetupSettings;
