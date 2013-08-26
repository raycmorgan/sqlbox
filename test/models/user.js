var sqlbox = require('../../lib/sqlbox');

var User = sqlbox.create({
  name: 'user',
  namespace: 'test',
  
  columns: [
    {name: 'name'}
  ],

  relations: [
    {type: 'hasMany', name: 'posts', foreignKey: 'authorId', model: 'post'},
    {type: 'hasMany', name: 'editedPosts', foreignKey: 'editorId', model: 'post'},
    {type: 'hasMany', name: 'comments', model: 'comment'}
  ]
});

module.exports = User;
