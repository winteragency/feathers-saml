"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-ignore
const querystring_1 = __importDefault(require("querystring"));
const debug_1 = __importDefault(require("debug"));
const authentication_1 = require("@feathersjs/authentication");
const debug = debug_1.default('feathers-saml/strategy');
class SamlStrategy extends authentication_1.AuthenticationBaseStrategy {
    get configuration() {
        const authConfig = this.authentication.configuration;
        const config = super.configuration || {};
        return Object.assign({ service: authConfig.service, entity: authConfig.entity, entityId: authConfig.entityId }, config);
    }
    get entityId() {
        const { entityService } = this;
        return this.configuration.entityId || (entityService && entityService.id);
    }
    getEntityQuery(samlUser, _params) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                [`email`]: samlUser.attributes.email
            };
        });
    }
    getEntityData(samlUser, _existingEntity, _params) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                [`email`]: samlUser.attributes.email,
                [`nameId`]: samlUser.name_id,
                [`sessionIndex`]: samlUser.session_index
            };
        });
    }
    /* istanbul ignore next */
    getSamlUser(data, _params) {
        return __awaiter(this, void 0, void 0, function* () {
            return data.user;
        });
    }
    getCurrentEntity(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { authentication } = params;
            const { entity } = this.configuration;
            if (authentication && authentication.strategy) {
                debug('getCurrentEntity with authentication', authentication);
                const { strategy } = authentication;
                const authResult = yield this.authentication.authenticate(authentication, params, strategy);
                return authResult[entity];
            }
            return null;
        });
    }
    getRedirect(data, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { redirect } = this.authentication.configuration.saml;
            if (!redirect) {
                return null;
            }
            const separator = redirect.endsWith('?') ? '' :
                (redirect.indexOf('#') !== -1 ? '?' : '#');
            const authResult = data;
            const query = authResult.accessToken ? {
                access_token: authResult.accessToken
            } : {
                error: data.message || 'SAML Authentication not successful'
            };
            return redirect + separator + querystring_1.default.stringify(query);
        });
    }
    findEntity(samlUser, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = yield this.getEntityQuery(samlUser, params);
            debug('findEntity with query', query);
            const result = yield this.entityService.find(Object.assign(Object.assign({}, params), { query }));
            const [entity = null] = result.data ? result.data : result;
            debug('findEntity returning', entity);
            return entity;
        });
    }
    createEntity(samlUser, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield this.getEntityData(samlUser, null, params);
            debug('createEntity with data', data);
            return this.entityService.create(data, params);
        });
    }
    updateEntity(entity, samlUser, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const id = entity[this.entityId];
            const data = yield this.getEntityData(samlUser, entity, params);
            debug(`updateEntity with id ${id} and data`, data);
            return this.entityService.patch(id, data, params);
        });
    }
    authenticate(authentication, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const entity = this.configuration.entity;
            const samlUser = yield this.getSamlUser(authentication, params);
            const existingEntity = (yield this.findEntity(samlUser, params)) || (yield this.getCurrentEntity(params));
            debug(`authenticate with (existing) entity`, existingEntity);
            const authEntity = !existingEntity ? yield this.createEntity(samlUser, params) : yield this.updateEntity(existingEntity, samlUser, params);
            return {
                authentication: { strategy: this.name },
                [entity]: authEntity
            };
        });
    }
}
exports.SamlStrategy = SamlStrategy;
//# sourceMappingURL=strategy.js.map