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
    {type: 'belongsTo', name: 'author', model: 'user'},
    {type: 'belongsTo', name: 'editor', model: 'user'},
    {type: 'hasMany', name: 'comments', model: 'comment'}
  ]
});

module.exports = Post;
