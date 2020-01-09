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
const debug_1 = __importDefault(require("debug"));
const express_1 = require("@feathersjs/express");
const debug = debug_1.default('feathers-saml/express');
exports.default = (options) => {
    return (feathersApp) => {
        const { authService } = options;
        const app = feathersApp;
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
        const authApp = express_1.original();
        authApp.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
            sp.create_login_request_url(idp, {}, (err, login_url, request_id) => __awaiter(void 0, void 0, void 0, function* () {
                if (err != null) {
                    return res.send(500);
                }
                res.redirect(login_url);
            }));
        }));
        authApp.post('/assert', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
            const service = app.defaultAuthentication(authService);
            const [strategy] = service.getStrategies('saml');
            const params = {
                authStrategies: [strategy.name]
            };
            const sendResponse = (data) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const redirect = yield strategy.getRedirect(data, params);
                    if (redirect !== null) {
                        res.redirect(redirect);
                    }
                    else if (data instanceof Error) {
                        throw data;
                    }
                    else {
                        res.json(data);
                    }
                }
                catch (error) {
                    debug('SAML error', error);
                    next(error);
                }
            });
            try {
                const samlResponse = yield new Promise((resolve, reject) => {
                    sp.post_assert(idp, {
                        request_body: req.body
                    }, (err, saml_response) => __awaiter(void 0, void 0, void 0, function* () {
                        if (err != null) {
                            reject(err);
                            return;
                        }
                        resolve(saml_response);
                    }));
                });
                const authentication = Object.assign({ strategy: strategy.name }, samlResponse);
                debug(`Calling ${authService}.create authentication with SAML strategy`);
                const authResult = yield service.create(authentication, params);
                debug('Successful SAML authentication, sending response');
                yield sendResponse(authResult);
            }
            catch (error) {
                debug('Received SAML authentication error', error.stack);
                yield sendResponse(error);
            }
        }));
        // TODO: Implement logout. Need a way to get NameId and SessionIndex here.
        authApp.get('/logout', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
            sp.create_logout_request_url(idp, {
                name_id: null,
                session_index: null
            }, (err, logout_url) => __awaiter(void 0, void 0, void 0, function* () {
                if (err != null) {
                    next(err);
                    return;
                }
                res.redirect(logout_url);
            }));
        }));
        app.use(path, authApp);
    };
};
//# sourceMappingURL=express.js.map