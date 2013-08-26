var sqlbox = require('../../lib/sqlbox');

var Comment = sqlbox.create({
  name: 'comment',
  namespace: 'test',

  columns: [
    {name: 'userId'},
    {name: 'postId'},
    {name: 'content'}
  ],

  relations: [
    {type: 'belongsTo', name: 'user', model: 'user'},
    {type: 'belongsTo', name: 'post', model: 'post'}
  ]
});

module.exports = Comment;
