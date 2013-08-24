var expect = require('expect.js')
  , helpers = require('./helpers')
  , sqlbox = require('../lib/sqlbox');

var User = require('./models/user')
  , Post = require('./models/post')
  , Comment = require('./models/comment');

function noop() {};

describe('Relations', function () {

  var userId;

  beforeEach(function (done) {
    sqlbox.createClient(function (pg) {
      var user = process.env.DATABASE_USER ? process.env.DATABASE_USER + ':@' : '';

      return new pg.Client('postgres://' + user + 'localhost/' + (process.env.DATABASE_NAME || process.env.USER));
    });

    helpers.createModelTables(sqlbox.clients.default, noop);

    User.save({name: 'Tim'}, noop);
    User.save({name: 'John'}, noop);
    User.save({name: 'Frank'}, function (err, user) {
      if (err) { return done(err); }

      userId = user.id;

      Post.save({authorId: userId, title: 'Post 1: Howdy'}, noop);
      Post.save({authorId: userId, editorId: userId, title: 'Post 2: Hello World'}, function (err, post) {
        if (err) { return done(); }

        Comment.save({userId: 1, postId: post.id, content: 'Comment 1: Hmm...'}, done);
      });
    });
  });

  afterEach(function (done) {
    helpers.dropModelTables(sqlbox.clients.default, function () {
      sqlbox.removeClient();
      done();
    });
  });

  describe('#get', function () {
    it('should be able to fetch a user with their posts', function (done) {
      User.get(userId, {includes: {'posts': 'comments'}}, function (err, user) {
        // console.log(user);
        expect(user.id).to.be(userId);
        expect(user.posts).to.be.an('array');

        done();
      });
    });
  });
});
