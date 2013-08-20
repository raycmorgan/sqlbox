var sqlbox = require('../../lib/sqlbox')
  , User = require('./user')
  , Comment = require('./comment');

var Post = sqlbox.create({
  name: 'post',
  
  columns: [
    {name: 'title'},
    {name: 'authorId'},
    {name: 'editorId'}
  ],

  relations: [
    {type: 'belongsTo', name: 'author', model: User},
    {type: 'belongsTo', name: 'editor', model: User},
    {type: 'hasMany', name: 'comments', model: Comment}
  ]
});