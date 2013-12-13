var sqlbox = require('../../lib/sqlbox');

var Post = sqlbox.create({
  name: 'post',
  namespace: 'test',
  
  columns: [
    {name: 'title'},
    {name: 'authorId'},
    {name: 'editorId'}
  ],

  relations: [
    {type: 'belongsTo', name: 'author', model: 'user', foreignKey: 'authorId'},
    {type: 'belongsTo', name: 'editor', model: 'user', foreignKey: 'editorId'},
    {type: 'hasMany', name: 'comments', model: 'comment', foreignKey: 'postId'}
  ]
});

module.exports = Post;
