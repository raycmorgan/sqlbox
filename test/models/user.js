var sqlbox = require('../../lib/sqlbox')
  , Post = require('./post')
  , Comment = require('./comment');

var User = sqlbox.create({
  name: 'user',
  
  columns: [
    {name: 'name'}
  ],

  relations: [
    {type: 'hasMany', name: 'posts', foreignKey: 'authorId', model: Post},
    {type: 'hasMany', name: 'editedPosts', foreignKey: 'editorId', model: Post},
    {type: 'hasMany', name: 'comments', model: Comment}
  ]
});

module.exports = User;
