'use strict'

const chai = require('chai')
const expect = chai.expect
const chaiSubset = require('chai-subset')

chai.use(chaiSubset)

const Cls = require('../index')

describe('setOptions', function () {
  it('should return the default options', function () {
    const cls = new Cls()
    expect(cls.options).to.include({
      path: '/tmp'
    })
  })

  it('should return options with custom path', function () {
    const cls = new Cls({
      path: '/home/user/tmp'
    })
    expect(cls.options).to.include({
      path: '/home/user/tmp'
    })
  })
})
