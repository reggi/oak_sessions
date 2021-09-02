import { nanoid } from 'https://deno.land/x/nanoid@v3.0.0/async.ts'
import MemoryStore from './stores/MemoryStore.js'
import CookieStore from './stores/CookieStore.js'

export default class Session {
  constructor (store = null) {
    this.store = store || new MemoryStore
  }

  initMiddleware() {
    return async (ctx, next) => {
      this.context = ctx

      if (typeof this.store.insertSessionMiddlewareContext !== 'undefined') {
        await this.store.insertSessionMiddlewareContext(ctx)
      }

      const sid = await ctx.cookies.get('session')

      if (sid && await this.sessionExists(sid)) {
        ctx.session = this.getSession(sid)
      } else {
        ctx.session = await this.createSession()
        await ctx.cookies.set('session', ctx.session.id)
      }

      await ctx.session.set('_flash', {})

      await next()

      if (typeof this.store.afterMiddlewareHook !== 'undefined') {
        await this.store.afterMiddlewareHook()
      }
    }
  }

  async sessionExists(id) {
    return await this.store.sessionExists(id)
  }

  async createSession() {
    this.id = await nanoid()
    await this.store.createSession(this.id)
    return this
  }

  getSession(id) {
    this.id = id
    return this
  }

  async deleteSession(sessionIdOrContext) {
    if (typeof sessionIdOrContext == 'string') {
      let sessionId = sessionIdOrContext
      await this.store.deleteSession(sessionId)
    } else {
      let ctx = sessionIdOrContext
      await this.store.deleteSession(
        this.store instanceof CookieStore 
        ? ctx 
        : await ctx.cookies.get('session')
      )
    }

    await this.context.cookies.delete('session')
  }

  async get(key) {
    const session = await this.store.getSessionById(this.id)

    if (session.hasOwnProperty(key)) {
      return session[key]
    } else {
      return session['_flash'][key]
    }
  }

  async set(key, value) {
    const session = await this.store.getSessionById(this.id)

    session[key] = value

    await this.store.persistSessionData(this.id, session)
  }

  async flash(key, value) {
    const session = await this.store.getSessionById(this.id)

    session['_flash'][key] = value

    await this.store.persistSessionData(this.id, session)
  }

  async has(key) {
    const session = await this.store.getSessionById(this.id)

    if (session.hasOwnProperty(key)) {
      return true
    } else {
      if (session['_flash'].hasOwnProperty(key)) {
        return true
      } else {
        return false
      }
    }
  }
}