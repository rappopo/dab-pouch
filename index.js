'use strict'

const PouchDB = require('pouchdb'),
  path = require('path'),
  Dab = require('@rappopo/dab')

PouchDB.plugin(require('pouchdb-find'))

class DabPouch extends Dab {
  constructor (options) {
    super(options)
  }

  setOptions (options) {
    super.setOptions(this._.merge(this.options, {
      idSrc: '_id',
      idDest: options.idDest || options.idSrc || '_id',
      path: options.path || '/tmp',
      dbName: options.dbName || 'test',
      retainOnRemove: options.retainOnRemove || [],
      inMemory: false,
    }))
  }

  setClient (params) {
    if (this.client) return
    let db = this.options.dbName
    if (!(db.substr(0, 7) === 'http://' || db.substr(0, 8) === 'https://'))
      db = path.join(this.options.path, this.options.dbName)
    this.client = new PouchDB(db, this.options.options)
  }

  find (params) {
    [params] = this.sanitize(params)
    this.setClient(params)
    let limit = params.limit || this.options.limit,
      skip = ((params.page || 1) - 1) * limit,
      sort = params.sort,
      query = params.query || {}
    return new Promise((resolve, reject) => {
      this.client.find({
        selector: query,
        sort: sort,
        limit: limit,
        skip: skip        
      })
      .then(result => {
        let data = { success: true, data: [] }
        result.docs.forEach((d, i) => {
          data.data.push(this.convertDoc(d))
        })
        resolve(data)
      })
      .catch(reject)
    })
  }

  _findOne (id, params, callback) {
    this.client.get(id, params.options || {}, (err, result) => {
      if (err) {
        return callback({
          success: false,
          err: err.status === 404 ? new Error('Not found') : err
        })
      }
      callback({
        success: true,
        data: result
      })
    })
  }

  findOne (id, params) {
    [params] = this.sanitize(params)
    this.setClient(params)
    return new Promise((resolve, reject) => {
      this._findOne(id, params.options || {}, result => {
        if (!result.success)
          return reject(result.err)
        let data = {
          success: true,
          data: this.convertDoc(result.data)
        }
        resolve(data)
      })
    })
  }

  _create (body, params, callback) {
    this.client.put(body, params.options || {}, (err, result) => {
      if (err)
        return callback({
          success: false,
          err: err
        })
      this._findOne(result.id, params, callback)
    })
  }

  create (body, params) {
    [params, body] = this.sanitize(params, body)
    this.setClient(params)
    return new Promise((resolve, reject) => {
      if (body[this.options.idDest] && this.options.idDest !== this.options.idSrc) {
        body[this.options.idSrc] = body[this.options.idDest]
        delete body[this.options.idDest]
      }
      let id = body[this.options.idSrc]
      if (id) {
        this._findOne(id, params, result => {
          if (result.success) 
            return reject(new Error('Exists'))
          this._create(body, params, result => {
            if (!result.success)
              return reject(result.err)
            result.data = this.convertDoc(result.data)
            resolve(result)
          })
        })
      } else {
        this._create(body, params, result => {
          if (!result.success)
            return reject(result.err)
          result.data = this.convertDoc(result.data)
          resolve(result)
        })        
      }
    })
  }

  update (id, body, params) {
    [params, body] = this.sanitize(params, body)
    this.setClient(params)
    body = this._.omit(body, [this.options.idDest || this.options.idSrc])
    return new Promise((resolve, reject) => {
      this._findOne(id, params, result => {
        if (!result.success)
          return reject(result.err)
        let source = result.data
        if (params.fullReplace) {
          body[this.options.idSrc] = id
          body._rev = result.data._rev
        } else {
          body = this._.merge(result.data, body)
        }
        this._create(body, params, result => {
          if (!result.success)
            return reject(result.err)
          result.data = this.convertDoc(result.data)
          if (params.withSource)
            result.source = this.convertDoc(source)
          resolve(result)
        })
      })
    })
  }

  remove (id, params) {
    [params] = this.sanitize(params)
    this.setClient(params)
    return new Promise((resolve, reject) => {
      this._findOne(id, params, result => {
        if (!result.success)
          return reject(result.err)
        let source = result.data,
          newBody = {
            _id: id,
            _rev: source._rev,
            _deleted: true
          }
        this._.each(this.options.retainOnRemove, r => {
          if (_.has(source, r))
            newBody[r] = source[r]
        })
        this.client.put(newBody, params.options || {}, (err, result) => {
          if (err)
            return reject(result.err)
          let data = {
            success: true
          }
          if (params.withSource)
            data.source = this.convertDoc(source)
          resolve(data)
        })
      })
    })
  }

  bulkCreate (body, params) {
    [params] = this.sanitize(params)
    this.setClient(params)
    return new Promise((resolve, reject) => {
      if (!this._.isArray(body))
        return reject(new Error('Require array'))
      this._.each(body, (b, i) => {
        if (!b[this.options.idSrc])
          b[this.options.idSrc] = this.uuid()
        body[i] = this._.omit(b, ['_rev', '_deleted'])
      })
      const keys = this._(body).map(this.options.idSrc).value()
      this.client.allDocs({
        keys: keys
      }, (err, result) => {
        if (err)
          return reject(err)
        let info = result.rows
        this.client.bulkDocs(body, (err, result) => {
          if (err)
            return reject(err)
          let ok = 0, status = []
          this._.each(result, (r, i) => {
            let stat = { success: r.ok ? true : false }
            stat[this.options.idDest] = r.id
            if (!stat.success)
              stat.reason = info[i] && info[i].value ? 'Exists' : this._.upperFirst(r.name)
            else
              ok++
            status.push(stat)
          })
          let data = {
            success: true,
            stat: {
              ok: ok,
              fail: body.length - ok,
              total: body.length
            },
            data: status
          }
          resolve(data)
        })    
      })
    })
  }

  bulkUpdate (body, params) {
    [params] = this.sanitize(params)
    this.setClient(params)
    return new Promise((resolve, reject) => {
      if (!this._.isArray(body))
        return reject(new Error('Require array'))
      this._.each(body, (b, i) => {
        if (!b[this.options.idSrc])
          b[this.options.idSrc] = this.uuid() // will likely to introduce 'not-found'
        body[i] = this._.omit(b, ['_rev', '_deleted'])
      })
      const keys = this._(body).map(this.options.idSrc).value()
      this.client.allDocs({
        keys: keys
      }, (err, result) => {
        if (err)
          return reject(err)
        let info = result.rows
        // add rev for known doc
        this._.each(body, (b, i) => {
          if (info[i] && info[i].value) 
            body[i]._rev = info[i].value.rev
          else
            body[i]._rev = '1-' + this.uuid() // will introduce purposed conflict
        })
        this.client.bulkDocs(body, (err, result) => {
          if (err)
            return reject(err)
          let ok = 0, status = []
          this._.each(result, (r, i) => {
            let stat = { success: r.ok ? true : false }
            stat[this.options.idDest] = r.id
            if (!stat.success)
              stat.reason = info[i] && info[i].error === 'not_found' ? 'Not found' : this._.upperFirst(r.name)
            else
              ok++
            status.push(stat)
          })
          let data = {
            success: true,
            stat: {
              ok: ok,
              fail: body.length - ok,
              total: body.length
            },
            data: status
          }
          resolve(data)
        })    
      })
    })
  }

  bulkRemove (body, params) {
    [params] = this.sanitize(params)
    this.setClient(params)
    return new Promise((resolve, reject) => {
      if (!this._.isArray(body))
        return reject(new Error('Require array'))
      this._.each(body, (b, i) => {
        if (!b[this.options.idSrc])
          b[this.options.idSrc] = this.uuid() // will likely to introduce 'not-found'
        body[i] = this._.omit(b, ['_rev', '_deleted'])
      })
      const keys = this._(body).map(this.options.idSrc).value()
      this.client.allDocs({
        keys: keys
      }, (err, result) => {
        if (err)
          return reject(err)
        let info = result.rows
        // add rev for known doc
        this._.each(body, (b, i) => {
          let newB = this._.pick(b, this.options.retainOnRemove)
          newB._deleted = true
          newB._id = b._id
          if (info[i] && info[i].value) 
            newB._rev = info[i].value.rev
          else
            newB._rev = '1-' + this.uuid() // will introduce purposed conflict
          body[i] = newB
        })
        this.client.bulkDocs(body, (err, result) => {
          if (err)
            return reject(err)
          let ok = 0, status = []
          this._.each(result, (r, i) => {
            let stat = { success: r.ok ? true : false }
            stat[this.options.idDest] = r.id
            if (!stat.success)
              stat.reason = info[i] && info[i].error === 'not_found' ? 'Not found' : this._.upperFirst(r.name)
            else
              ok++
            status.push(stat)
          })
          let data = {
            success: true,
            stat: {
              ok: ok,
              fail: body.length - ok,
              total: body.length
            },
            data: status
          }
          resolve(data)
        })    
      })
    })
  }

}

module.exports = DabPouch