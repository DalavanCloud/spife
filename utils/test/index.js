'use strict'

module.exports = createTestServer

const loadSettings = require('../../lib/settings')
const Server = require('../../lib/server')

const http = require('http')

const READY_MAP = new WeakMap()

function _getonready (server) {
  return new Promise((resolve, reject) => {
    READY_MAP.set(server, {resolve, reject})
  })
}

class Suite {
  constructor (spife, processSuiteOnion, processTestcaseOnion) {
    this.spife = spife
    this.onready = _getonready(this)
    this.onfinish = processSuiteOnion(this)
  }

  isolate (fn) {
    return async (...args) => {
      await this.spife.onready
      await this.onready
      return this.processTestcase(this, fn, args)
    }
  }

  [READY] () {
    const {resolve} = READY_MAP.get(this)
    this.onready = _getonready(this)
  }
}

function createTestServer (settingsPath, overrides) {
  const spife = _loadServer(settingsPath, {middleware = null, router = null} = {})

  const processSuiteMiddleware = []
  const processTestcaseMiddleware = [{
    async processTestcase (fn, args, next) {
      const [err, result] = await next(fn, args)
      if (err) {
        throw err
      }
    }
  }]

  for (const xs of spife._middleware) {
    if (typeof xs.processSuite === 'function') {
      processSuite.push(xs.processSuite.bind(xs))
    }

    if (typeof xs.processTestcase === 'function') {
      processTestcase.push(xs.processTestcase.bind(xs))
    }
  }

  const processSuiteOnion = onion.sprout(
    processSuiteMiddleware,
    suite => {
      suite[READY]()
    },
    1
  )

  const processTestcaseOnion = onion.sprout(
    processTestcaseMiddleware,
    (suite, fn, args) => {
      try {
        return [null, await fn(...args)]
      } catch (err) {
        return [err, null]
      }
    },
    3
  )

  return new Suite(spife, processSuiteOnion, processTestcaseOnion)
}

function _loadServer (path, {
  middleware = [
    '@npm/spife/middleware/test-request-interceptor',
    '@npm/spife/middleware/test-inject-request'
  ],
  router = null
} = {}) {
  const settings = loadSettings(path, {
    HOT: false,
    MIDDLEWARE: middleware,
    ...(router ? {ROUTER: router} : {})
  })

  const server = http.createServer()
  const spife = new Server(
    'test-' + settings.NAME,
    server,
    router || settings.ROUTER,
    settings.MIDDLEWARE,
    {settings, isExternal: false, isTest: true}
  )

  return {spife, settings}
}
