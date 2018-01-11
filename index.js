'use strict'

const PouchDB = require('pouchdb'),
  path = require('path'),
  Dab = require('@rappopo/dab').Dab

PouchDB.plugin(require('pouchdb-find'))

class DabPouch extends Dab {
  constructor (options) {
    super(options)
    this.client = {}
  }

  setOptions (options) {
    super.setOptions(this._.merge(this.options, {
      path: options.path || '/tmp',
      retainOnRemove: options.retainOnRemove || []
    }))
  }

  setClient (params) {
    params = params || {}
    if (this.client[params.collection]) return
    if (this._.keys(this.collection).indexOf(params.collection) === -1)
      return new Error('Collection not found')
    let fullPath = path.join(this.options.path, params.collection)
    this.client[params.collection] = new PouchDB(fullPath, this.options.options)
  }

  createCollection (coll, params) {
    params = params || {}
    return new Promise((resolve, reject) => {
      super.createCollection(coll)
        .then(result => {
          let e = this.setClient({ collection: coll.name })
          resolve(result)
        })
        .catch(reject)
    })
  }

  renameCollection (oldName, newName, params) {
    params = params || {}
    return Promise.reject(new Error('Not implemented'))
  }

  removeCollection (name, params) {
    params = params || {}
    let rebuild = params.withSchema && this.collection[name] && !this._.isEmpty(this.collection[name].attributes)
    return new Promise((resolve, reject) => {
      super.removeCollection(name)
        .then(result => {
          if (!rebuild) {
            delete this.client[name]
            return resolve({ success: true })
          }
          return this.client[name].destroy()
        })
        .then(result => {
          delete this.client[name]
          resolve({ success: true })
        })
        .catch(reject)
    })
  }  

  find (params) {
    [params] = this.sanitize(params)
    let limit = params.limit || this.options.limit,
      skip = ((params.page || 1) - 1) * limit,
      sort = params.sort,
      query = params.query || {},
      sortKeys = []
    if (this._.isArray(sort))
      this._.each(sort, s => {
        this._.forOwn(s, (v, k) => {
          sortKeys.push(k)
        })
      })

    sortKeys = this._.uniq(sortKeys)
    if (sortKeys.length > 0) {
      let qidx = {}
      this._.each(sortKeys, k => {
        qidx[k] = { $gte: null }
      })
      query = this._.merge(query, qidx)
    }

    return new Promise((resolve, reject) => {
      let e = this.setClient(params)
      if (e instanceof Error)
        return reject(e)
      let q = {
        selector: query,
        limit: limit,
        skip: skip
      }
      if (sort) {
        q.sort = sort
      }
      this.client[params.collection].find(q)
      .then(result => {
        let data = { success: true, data: [] }
        result.docs.forEach((d, i) => {
          data.data.push(this.convert(d, { collection: params.collection }))
        })
        resolve(data)
      })
      .catch(reject)
    })
  }

  _findOne (id, params, callback) {
    let e = this.setClient(params)
    if (e instanceof Error)
      return callback({
        success: false,
        err: e
      })
    this.client[params.collection].get(id, params.options || {}, (err, result) => {
      if (err) {
        return callback({
          success: false,
          err: err.status === 404 ? new Error('Document not found') : err
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
      this._findOne(id, params, result => {
        if (!result.success)
          return reject(result.err)
        let data = {
          success: true,
          data: this.convert(result.data, { collection: params.collection })
        }
        resolve(data)
      })
    })
  }

  _create (body, params, callback) {
    let e = this.setClient(params)
    if (e instanceof Error)
      return callback({
        success: false,
        err: e
      })
    this.client[params.collection].put(body, params.options || {}, (err, result) => {
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
    return new Promise((resolve, reject) => {
      if (body._id) {
        this._findOne(body._id, params, result => {
          if (result.success) 
            return reject(new Error('Document already exists'))
          this._create(body, params, result => {
            if (!result.success)
              return reject(result.err)
            result.data = this.convert(result.data, { collection: params.collection })
            resolve(result)
          })
        })
      } else {
        this._create(body, params, result => {
          if (!result.success)
            return reject(result.err)
          result.data = this.convert(result.data, { collection: params.collection })
          resolve(result)
        })        
      }
    })
  }

  update (id, body, params) {
    [params, body] = this.sanitize(params, body)
    body = this._.omit(body, ['_id'])
    return new Promise((resolve, reject) => {
      this._findOne(id, params, result => {
        if (!result.success)
          return reject(result.err)
        let source = result.data
        if (params.fullReplace) {
          body._id = id
          body._rev = result.data._rev
        } else {
          body = this._.merge(result.data, body)
        }
        this._create(body, params, result => {
          if (!result.success)
            return reject(result.err)
          result.data = this.convert(result.data, { collection: params.collection })
          if (params.withSource)
            result.source = this.convert(source, { collection: params.collection })
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
        this.client[params.collection].put(newBody, params.options || {}, (err, result) => {
          if (err)
            return reject(result.err)
          let data = {
            success: true
          }
          if (params.withSource)
            data.source = this.convert(source, { collection: params.collection })
          resolve(data)
        })
      })
    })
  }

  bulkCreate (body, params) {
    [params] = this.sanitize(params)
    return new Promise((resolve, reject) => {
      let e = this.setClient(params)
      if (e instanceof Error)
        return reject(e)
      if (!this._.isArray(body))
        return reject(new Error('Requires an array'))
      this._.each(body, (b, i) => {
        if (!b._id)
          b._id = this.uuid()
        body[i] = this._.omit(b, ['_rev', '_deleted'])
      })
      const keys = this._(body).map('_id').value()
      this.client[params.collection].allDocs({
        keys: keys
      }, (err, result) => {
        if (err)
          return reject(err)
        let info = result.rows
        this.client[params.collection].bulkDocs(body, (err, result) => {
          if (err)
            return reject(err)
          let ok = 0, status = []
          this._.each(result, (r, i) => {
            let stat = { success: r.ok ? true : false }
            stat._id = r.id
            if (!stat.success)
              stat.message = info[i] && info[i].value ? 'Document already exists' : this._.upperFirst(r.name)
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
            }
          }
          if (params.withDetail)
            data.detail = status
          resolve(data)
        })    
      })
    })
  }

  bulkUpdate (body, params) {
    [params] = this.sanitize(params)
    this.setClient(params)
    return new Promise((resolve, reject) => {
      let e = this.setClient(params)
      if (e instanceof Error)
        return reject(e)
      if (!this._.isArray(body))
        return reject(new Error('Requires an array'))
      this._.each(body, (b, i) => {
        if (!b._id)
          b._id = this.uuid() // will likely to introduce 'not-found'
        body[i] = this._.omit(b, ['_rev', '_deleted'])
      })
      const keys = this._(body).map('_id').value()
      this.client[params.collection].allDocs({
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
        this.client[params.collection].bulkDocs(body, (err, result) => {
          if (err)
            return reject(err)
          let ok = 0, status = []
          this._.each(result, (r, i) => {
            let stat = { success: r.ok ? true : false }
            stat._id = r.id
            if (!stat.success)
              stat.message = info[i] && info[i].error === 'not_found' ? 'Document not found' : this._.upperFirst(r.name)
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
            }
          }
          if (params.withDetail)
            data.detail = status
          resolve(data)
        })    
      })
    })
  }

  bulkRemove (body, params) {
    [params] = this.sanitize(params)
    this.setClient(params)
    return new Promise((resolve, reject) => {
      let e = this.setClient(params)
      if (e instanceof Error)
        return reject(e)
      if (!this._.isArray(body))
        return reject(new Error('Requires an array'))
      this._.each(body, (b, i) => {
        body[i] = b || this.uuid()
      })
      this.client[params.collection].allDocs({
        keys: body
      }, (err, result) => {
        if (err)
          return reject(err)
        let info = result.rows
        // add rev for known doc
        this._.each(body, (b, i) => {
          let newB = {
            _deleted: true,
            _id: b
          }
          if (info[i] && info[i].value) {
            newB._rev = info[i].value.rev
            newB = this._.merge(newB, this._.pick(info[i].value.doc, this.options.retainOnRemove))
          } else {
            newB._rev = '1-' + this.uuid() // will introduce purposed conflict
          }
          body[i] = newB
        })
        this.client[params.collection].bulkDocs(body, (err, result) => {
          if (err)
            return reject(err)
          let ok = 0, status = []
          this._.each(result, (r, i) => {
            let stat = { success: r.ok ? true : false }
            stat._id = r.id
            if (!stat.success)
              stat.message = info[i] && info[i].error === 'not_found' ? 'Document not found' : this._.upperFirst(r.name)
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
            }
          }
          if (params.withDetail)
            data.detail = status
          resolve(data)
        })    
      })
    })
  }

}

module.exports = DabPouch