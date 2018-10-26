'use strict'

module.exports = createDatabaseMiddleware

const Promise = require('bluebird')

const pg = require('../db/connection')
const db = require('../db/session')
const orm = require('../db/orm')

const logger = require('../logging')('database')

function createDatabaseMiddleware (opts) {
  opts = opts || {}
  opts.postgres = opts.postgres || {}
  var poolTimer = null
  var pool = null
  return {
    processServer (spife, next) {
      orm.setConnection(db.getConnection)
      pool = new pg.Pool(opts.postgres)
      pool.on('error', err => {
        logger.error('pool client received error:')
        logger.error(err)
      })

      const dbMetricsInterval = (
        Number(process.env.PROCESS_METRICS_INTERVAL) ||
        1000
      )

      opts.metrics = opts.metrics || defaultMetrics(spife.name)
      poolTimer = setInterval(() => {
        process.emit('metric', {
          'name': `${spife.name}.pg-pool-available`,
          'value': pool.pool.availableObjectsCount()
        })
        process.emit('metric', {
          'name': `${spife.name}.pg-pool-waiting`,
          'value': pool.pool.waitingClientsCount()
        })
      }, dbMetricsInterval)

      return next(spife).then(() => {
        clearInterval(poolTimer)
        const closed = pool.end()
        pool = null
        return closed
      })
    },

    processRequest (request, next) {
      db.install(process.domain, () => {
        return new Promise((resolve, reject) => {
          pool.connect((err, connection, release) => {
            err ? reject(err) : resolve({connection, release})
          })
        })
      }, Object.assign(
        {},
        opts.metrics || {},
        {maxConcurrency: opts.maxConnectionsPerRequest}
      ))

      return next(request)
    },

    processView (req, match, context, next) {
      db.session.viewName = req.viewName
      return next(req, match, context)
    }
  }
}

function defaultMetrics (name) {
  var lastIdleTime = Date.now()
  var emittedIdleExit = false
  const batonMap = new WeakMap()
  return {
    onSessionIdle () {
      lastIdleTime = Date.now()
      emittedIdleExit = false
    },
    onSubsessionStart (parent, child) {
      child.viewName = parent.viewName
    },
    onConnectionRequest (baton) {
      // (onConnectionRequest - lastIdleTime) = "how long do we idle for?"
      const now = Date.now()
      if (!emittedIdleExit) {
        emittedIdleExit = true
        process.emit('metric', {
          name: `${name}.idleTime`,
          value: now - lastIdleTime
        })
      }
      batonMap.set(baton, {
        request: now,
        start: null
      })
    },
    onConnectionStart (baton) {
      // onConnectionStart - onConnectionRequest = "How long did we have to
      // wait for other connections (server-wide!) to complete?"
      const info = batonMap.get(baton)
      if (!info) {
        return
      }
      info.start = Date.now()
      process.emit('metric', {
        name: `${name}.connectionWait`,
        value: info.start - info.request,
        view: db.session.viewName
      })
    },
    onConnectionFinish (baton) {
      const info = batonMap.get(baton)
      if (!info) {
        return
      }
      process.emit('metric', {
        name: `${name}.connectionDuration`,
        value: Date.now() - info.start,
        view: db.session.viewName
      })
    },
    onTransactionConnectionRequest (txnBaton) {
      process.emit('metric', {
        name: `${name}.query`,
        count: 1,
        view: db.session.viewName
      })
      batonMap.set(txnBaton, {
        request: Date.now(),
        start: null
      })
    },
    onTransactionConnectionStart (txnBaton) {
      // onTransactionConnectionStart - onTransactionConnectionRequest = "How
      // long did we have to wait for other connections (request-wide!) to
      // complete?"
      const info = batonMap.get(txnBaton)
      if (!info) {
        return
      }
      info.start = Date.now()
      process.emit('metric', {
        name: `${name}.transactionWait`,
        value: info.start - info.request,
        view: db.session.viewName
      })
    },
    onTransactionConnectionFinish (txnBaton) {
      const info = batonMap.get(txnBaton)
      if (!info) {
        return
      }
      process.emit('metric', {
        name: `${name}.transactionDuration`,
        value: Date.now() - info.start,
        view: db.session.viewName
      })
    }
  }
}
