// @ts-ignore
import querystring from 'querystring'
import Debug from 'debug'
import {
  AuthenticationRequest,
  AuthenticationBase,
  AuthenticationBaseStrategy,
  AuthenticationResult
} from '@feathersjs/authentication'
import { Application, Params } from '@feathersjs/feathers'

const debug = Debug('feathers-saml/strategy')

export interface SamlUser {
  name_id: String | number
  session_index: String | number
  attributes: {
    [key: string]: any
  }
}

export class SamlStrategy extends AuthenticationBaseStrategy {
  name = 'SamlStrategy'

  get configuration() {
    const authConfig = this.authentication
      ? {
          service: this.authentication.configuration.service,
          entity: this.authentication.configuration.entity,
          entityId: this.authentication.configuration.entityId
        }
      : {}
    const config = super.configuration || {}

    return {
      ...authConfig,
      ...config
    }
  }

  get entityId(): string {
    const { entityService } = this

    return this.configuration.entityId || (entityService && entityService.id)
  }

  async getEntityQuery(samlUser: SamlUser, _params: Params) {
    return {
      [`email`]: samlUser.attributes.email
    }
  }

  async getEntityData(
    samlUser: SamlUser,
    _existingEntity: any,
    _params: Params
  ) {
    return {
      [`email`]: samlUser.attributes.email,
      [`nameId`]: samlUser.name_id,
      [`sessionIndex`]: samlUser.session_index
    }
  }

  /* istanbul ignore next */
  async getSamlUser(data: AuthenticationRequest, _params: Params) {
    return data.user
  }

  async getCurrentEntity(params: Params) {
    const { authentication } = params
    const { entity } = this.configuration

    if (authentication && authentication.strategy) {
      debug('getCurrentEntity with authentication', authentication)

      const { strategy } = authentication
      const authResult = await authentication.authenticate(
        authentication,
        params,
        strategy
      )

      return authResult[entity]
    }

    return null
  }

  async getRedirect(data: AuthenticationResult | Error, params?: Params) {
    if (
      !(this.authentication && this.authentication.configuration.saml.redirect)
    ) {
      return null
    }

    const { redirect } = this.authentication.configuration.saml

    const separator = redirect.endsWith('?')
      ? ''
      : redirect.indexOf('#') !== -1
      ? '?'
      : '#'
    const authResult: AuthenticationResult = data
    const query = authResult.accessToken
      ? {
          access_token: authResult.accessToken
        }
      : {
          error: data.message || 'SAML Authentication not successful'
        }

    return redirect + separator + querystring.stringify(query)
  }

  async findEntity(samlUser: SamlUser, params: Params) {
    const query = await this.getEntityQuery(samlUser, params)

    debug('findEntity with query', query)

    const result = await this.entityService.find({
      ...params,
      query
    })
    const [entity = null] = result.data ? result.data : result

    debug('findEntity returning', entity)

    return entity
  }

  async createEntity(samlUser: SamlUser, params: Params) {
    const data = await this.getEntityData(samlUser, null, params)

    debug('createEntity with data', data)

    return this.entityService.create(data, params)
  }

  async updateEntity(entity: any, samlUser: SamlUser, params: Params) {
    const id = entity[this.entityId]
    const data = await this.getEntityData(samlUser, entity, params)

    debug(`updateEntity with id ${id} and data`, data)

    return this.entityService.patch(id, data, params)
  }

  async authenticate(authentication: AuthenticationRequest, params: Params) {
    const entity: string = this.configuration.entity
    const samlUser: SamlUser = await this.getSamlUser(authentication, params)
    const existingEntity =
      (await this.findEntity(samlUser, params)) ||
      (await this.getCurrentEntity(params))

    debug(`authenticate with (existing) entity`, existingEntity)

    const authEntity = !existingEntity
      ? await this.createEntity(samlUser, params)
      : await this.updateEntity(existingEntity, samlUser, params)

    return {
      authentication: { strategy: this.name },
      [entity]: authEntity
    }
  }
}
