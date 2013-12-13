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
    {type: 'belongsTo', name: 'user', model: 'user', foreignKey: 'userId'},
    {type: 'belongsTo', name: 'post', model: 'post', foreignKey: 'postId'}
  ]
});

module.exports = Comment;
