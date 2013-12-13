var sql = require('sql');
var _ = require('underscore')

users = sql.define({
  name: 'users',
  columns: ['id', 'name']
});

posts = sql.define({
  name: 'posts',
  columns: ['id', 'title', 'author_id', 'editor_id']
});

comments = sql.define({
  name: 'comments',
  columns: ['id', 'body', 'post_id', 'user_id']
});



// User.all({include: ['comments', {posts: 'editor'}]}, function () { /* ... */ });


// rootTable = u;



// {table: p, joinsOn: u.id.equals(p.author_id)}



var u = users.as('users');
var p = posts.as('users.posts');
var e = users.as('users.posts.editor');
var c = comments.as('users.comments');

var res = users.from(u.join(p).on(u.id.equals(p.author_id))
                      .join(c).on(u.id.equals(c.user_id))
                      .join(e).on(p.editor_id.equals(e.id)));

_.each([u, p, e, c], function (t) {
  _.each(_.pluck(t.columns, 'name'), function (column) {
    res.select(t[column].as(t.alias + '.' + column));
  });
});

console.log('\n>> ', res.toString(), '\n');
