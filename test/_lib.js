'use strict'

const path = require('path'),
  PouchDB = require('pouchdb'),
  _ = require('lodash')

module.exports = {
  _: _,
  options: {
    path: '/tmp',
    dbName: 'test'
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
    let me = this,
      db = new PouchDB(path.join(me.options.path, me.options.dbName))
    db.destroy(function (err) {
      if (err) return callback(err)
      db = new PouchDB(path.join(me.options.path, me.options.dbName))
      db.bulkDocs(me.dummyData, function(err, results) {
        callback(err)
      })
    })
  }
}

