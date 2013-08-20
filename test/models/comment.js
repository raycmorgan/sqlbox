var sqlbox = require('../../lib/sqlbox')
  , User = require('./user')
  , Post = require('./post');

var Comment = sqlbox.create({
  name: 'comment',

  columns: [
    {name: 'userId'},
    {name: 'postId'},
    {name: 'content'}
  ],

  relations: [
    {type: 'belongsTo', name: 'user', model: User},
    {type: 'belongsTo', name: 'post', model: Post}
  ]
});