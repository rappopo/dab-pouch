'use strict'

const path = require('path'),
  PouchDB = require('pouchdb'),
  async = require('async'),
  _ = require('lodash')

module.exports = {
  _: _,
  options: {
    path: '/tmp',
    dbName: 'test'
  },
  options1: {
    path: '/tmp',
    dbName: 'test1'
  },
  dummyData: [
    { _id: 'jack-bauer', name: 'Jack Bauer' },
    { _id: 'james-bond', name: 'James Bond' }
  ],
  bulkDocs: [
    { _id: 'jack-bauer', name: 'Jack Bauer' },
    { _id: 'johnny-english', name: 'Johnny English' },
    { name: 'Jane Boo' }
  ],
  timeout: 5000,
  resetDb: function (callback) {
    let me = this

    async.mapSeries(['options', 'options1'], function(o, callb) {
      let db = new PouchDB(path.join(me[o].path, me[o].dbName))
      db.destroy(function (err) {
        if (err) return callb(err)
        db = new PouchDB(path.join(me[o].path, me[o].dbName))
        db.bulkDocs(me.dummyData, function(err, results) {
          callb(err)
        })
      })      
    }, callback)
  }
}

