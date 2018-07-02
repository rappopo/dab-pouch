# @rappopo/dab-pouch

A [Rappopo DAB](https://github.com/rappopo/dab) implementation for PouchDB.

## Installation

Simply invoke this command in your project folder:

```
$ npm install --save @rappopo/dab-pouch
```

And within your script:

```javascript
const DabPouch = require('@rappopo/dab-pouch')
const dab = new DabPouch({
  path: '/home/me/pouchdb'
})
// prepare collections
dab.createCollection({ name: 'test' })
  .then(result => {
    return dab.bulkCreate(data, { collection: 'test' })
  })
...
// lets dab!
dab.findOne('my-doc', 'test').then(function(doc) { ... })
```

## Options

`path`: the path where all PouchDB folder will be saved and reside. If it not provided, it'll defaults to */tmp*

`retainOnRemove`: array of columns to retain when a document is deleted. Default: [].

When PouchDB delete a document, it actually PUTs a document with content like this:

```javascript
{
  "_id": "<doc_id>",
  "_rev": "<rev_id>",
  "_deleted": true
}
```

But sometimes you want to also have some columns to be put on that deleted document. The `retainOnRemove` simply left those columns intact, e.g:

```javascript
{
  "_id": "<doc_id>",
  "_rev": "<rev_id>",
  "_deleted": true,
  "type": "<mytype>"
}
```

## Features

* [x] [find](https://docs.rappopo.com/dab/method/find/)
* [x] [findOne](https://docs.rappopo.com/dab/method/find-one/)
* [x] [create](https://docs.rappopo.com/dab/method/create/)
* [x] [update](https://docs.rappopo.com/dab/method/update/)
* [x] [remove](https://docs.rappopo.com/dab/method/remove/)
* [x] [bulkCreate](https://docs.rappopo.com/dab/method/bulk-create/)
* [x] [bulkUpdate](https://docs.rappopo.com/dab/method/bulk-update/)
* [x] [bulkRemove](https://docs.rappopo.com/dab/method/bulk-remove/)
* [x] [copyFrom](https://docs.rappopo.com/dab/method/copy-from/)
* [x] [copyTo](https://docs.rappopo.com/dab/method/copy-to/)
* [x] [createCollection](https://docs.rappopo.com/dab/method/create-collection/)
* [ ] [renameCollection](https://docs.rappopo.com/dab/method/rename-collection/)
* [x] [removeCollection](https://docs.rappopo.com/dab/method/remove-collection/)

## Donation
* [![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://paypal.me/ardhilukianto)
* Bitcoin **16HVCkdaNMvw3YdBYGHbtt3K5bmpRmH74Y**

## License

[MIT](LICENSE.md)
