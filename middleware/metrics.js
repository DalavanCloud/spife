'use strict'

module.exports = createMiddleware

const procMetrics = require('numbat-process')
const EE = require('events')

const reply = require('../reply')

function createMiddleware () {
  var closeProcMetrics = null
  return {
    processServer (spife, next) {
      const procMetricsInterval = (
        Number(process.env.PROCESS_METRICS_INTERVAL) ||
        1000 * 30
      )
      closeProcMetrics = procMetrics(spife.metrics, procMetricsInterval)
      return next(spife).then(() => {
        closeProcMetrics()
      })
    },

    processRequest (req, next) {
      return next(req).then(resp => {
        recordMetric(req, resp, 200)
        return resp
      }).catch(err => {
        recordMetric(req, err, 500)
        throw err
      })
    },

    processBody (req, stream, next) {
      let size = 0
      const start = Date.now()
      EE.prototype.on.call(req, 'data', chunk => {
        size += chunk.length
      })

      return next(req, stream).then(result => {
        process.emit('metric', {
          name: 'body.latency',
          value: Date.now() - start,
          route: req.viewName,
          result: 'success'
        })
        process.emit('metric', {
          name: 'body.size',
          value: size,
          route: req.viewName,
          result: 'success'
        })

        return result
      }, err => {
        process.emit('metric', {
          name: 'body.latency',
          value: Date.now() - start,
          route: req.viewName,
          result: 'failure'
        })
        process.emit('metric', {
          name: 'body.size',
          value: size,
          route: req.viewName,
          result: 'failure'
        })
        throw err
      })
    }
  }
}

function recordMetric (req, res, defaultCode) {
  const latency = req.latency
  process.emit('metric', {
    name: 'latency',
    value: latency,
    route: req.viewName
  })
  const status = reply.status(res) || defaultCode
  process.emit('metric', {
    name: 'response',
    statusCode: status,
    value: latency,
    route: req.viewName
  })
}
