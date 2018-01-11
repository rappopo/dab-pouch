'use strict'

const path = require('path'),
  PouchDB = require('pouchdb'),
  async = require('async'),
  _ = require('lodash')

module.exports = {
  _: _,
  options: {
    path: '/tmp'
  },
  schema: {
    name: 'test'
  },
  schemaDummy: {
    name: 'test1'
  },
  schemaFull: {
    name: 'full',
    attributes: {
      _id: 'string',
      name: 'string',
      age: 'integer'
    }
  },
  schemaHidden: {
    name: 'hidden',
    attributes: {
      _id: 'string',
      name: { type: 'string', hidden: true },
      age: 'integer'
    }
  },
  schemaMask: {
    name: 'mask',
    attributes: {
      _id: { type: 'string', mask: 'id' },
      name: { type: 'string', mask: 'fullname' },
      age: { type: 'integer' }
    }
  },
  schemaMaskDummy: {
    name: 'mask1',
    attributes: {
      _id: { type: 'string', mask: 'id' },
      name: { type: 'string', mask: 'fullname' },
      age: { type: 'integer' }
    }
  },
  schemaBulk: {
    name: 'test1'
  },
  docs: [
    { _id: 'jack-bauer', name: 'Jack Bauer' },
    { _id: 'johnny-english', name: 'Johnny English' },
    { name: 'Jane Boo', age: 20 }
  ],
  docsMask: [
    { id: 'jack-bauer', fullname: 'Jack Bauer' },
    { id: 'johnny-english', fullname: 'Johnny English' },
    { fullname: 'Jane Boo', age: 20 }
  ],
  timeout: 5000,
  resetDb: function (callback, fillIn = true) {
    let me = this

    async.mapSeries(['schema', 'schemaFull', 'schemaHidden', 'schemaMask', 'schemaBulk', 'schemaDummy', 'schemaMaskDummy'], function(s, callb) {
      let db = new PouchDB(path.join(me.options.path, me[s].name))
      db.destroy(function (err) {
        if (err) return callb(err)
        db = new PouchDB(path.join(me.options.path, me[s].name))
        if (['test1', 'mask1'].indexOf(me[s].name) > -1 || !fillIn)
          return callb(null, null)
        db.bulkDocs(me.docs, function(err, results) {
          db.createIndex({
            index: {
              fields: ['name', 'age']
            }
          }, function(err) {
            callb(null, null)
          })
        })
      })      
    }, callback)
  }
}

