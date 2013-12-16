var sqlbox = require('../../lib/sqlbox');

var User = sqlbox.create({
  name: 'user',
  namespace: 'test',
  
  columns: [
    {name: 'name'},
    {name: 'organizationId'}
  ],

  relations: [
    {type: 'hasMany', name: 'posts', foreignKey: 'authorId', model: 'post'},
    {type: 'hasMany', name: 'editedPosts', foreignKey: 'editorId', model: 'post'},
    {type: 'hasMany', name: 'comments', model: 'comment'},
    {type: 'belongsTo', name: 'organization', model: 'organization'}
  ]
});

module.exports = User;
