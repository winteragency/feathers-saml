import { AuthenticationRequest, AuthenticationBaseStrategy, AuthenticationResult } from '@feathersjs/authentication';
import { Params } from '@feathersjs/feathers';
export interface SamlUser {
    name_id: String | number;
    session_index: String | number;
    attributes: {
        [key: string]: any;
    };
}
export declare class SamlStrategy extends AuthenticationBaseStrategy {
    get configuration(): any;
    get entityId(): string;
    getEntityQuery(samlUser: SamlUser, _params: Params): Promise<{
        [`email`]: any;
    }>;
    getEntityData(samlUser: SamlUser, _existingEntity: any, _params: Params): Promise<{
        [`email`]: any;
        [`nameId`]: number | String;
        [`sessionIndex`]: number | String;
    }>;
    getSamlUser(data: AuthenticationRequest, _params: Params): Promise<any>;
    getCurrentEntity(params: Params): Promise<any>;
    getRedirect(data: AuthenticationResult | Error, params?: Params): Promise<string>;
    findEntity(samlUser: SamlUser, params: Params): Promise<any>;
    createEntity(samlUser: SamlUser, params: Params): Promise<any>;
    updateEntity(entity: any, samlUser: SamlUser, params: Params): Promise<any>;
    authenticate(authentication: AuthenticationRequest, params: Params): Promise<{
        [x: string]: any;
        authentication: {
            strategy: string;
        };
    }>;
}
