"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const strategy_1 = require("./strategy");
exports.SamlStrategy = strategy_1.SamlStrategy;
const express_1 = __importDefault(require("./express"));
const utils_1 = require("./utils");
const saml2_js_1 = __importDefault(require("saml2-js"));
const fs_1 = __importDefault(require("fs"));
const debug = debug_1.default('feathers-saml');
exports.setup = (options) => (app) => {
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
    const sp = new saml2_js_1.default.ServiceProvider(Object.assign(Object.assign({}, saml.sp), { private_key: fs_1.default.readFileSync(saml.sp.private_key).toString(), certificate: fs_1.default.readFileSync(saml.sp.certificate).toString() }));
    debug(`Creating  SAML IdP`);
    const idp = new saml2_js_1.default.IdentityProvider(Object.assign(Object.assign({}, saml.idp), { certificates: saml.idp.certificates.map((certificate) => fs_1.default.readFileSync(certificate).toString()) }));
    debug(`Setting app global SAML object`);
    app.set('saml', Object.assign(Object.assign({}, saml), { path: saml.path ? saml.path : '/saml', sp: sp, idp: idp }));
};
exports.express = (settings = {}) => (app) => {
    const options = utils_1.getDefaultSettings(app, settings);
    app.configure(exports.setup(options));
    app.configure(express_1.default(options));
};
exports.expressSaml = exports.express;
//# sourceMappingURL=index.js.map