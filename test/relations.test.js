var expect = require('expect.js')
  , helpers = require('./helpers')
  , sqlbox = require('../lib/sqlbox');

var User = require('./models/user')
  , Post = require('./models/post')
  , Comment = require('./models/comment');

function noop() {};

describe.only('Relations', function () {

  var userId;

  beforeEach(function (done) {
    user = process.env.POSTGRES_USER ? process.env.POSTGRES_USER + ':@' : '';

    sqlbox.createClient({
      dbURL: 'postgres://' + user + 'localhost/' + (process.env.DATABASE_NAME || process.env.USER),
      poolMin: 2,
      pooMax: 10
    });

    helpers.createModelTables(sqlbox.clients.default, noop);

    User.save({name: 'Tim'}, noop);
    User.save({name: 'John'}, noop);
    User.save({name: 'Frank'}, function (err, user) {
      if (err) { return done(err); }

      userId = user.id;

      Post.save({authorId: userId, title: 'Post 1: Howdy'}, noop);
      Post.save({authorId: 1, title: 'Another post'}, noop);
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
    it('should be able to fetch a post and its author', function (done) {
      Post.get(1, {includes: 'author'}, function (err, post) {
        if (err) console.log(err);
        expect(post.author.id).to.be(userId);
        done();
      });
    });

    // it('should be able to fetch a user with their posts and comments (hasMany)', function (done) {
    //   User.get(userId, {includes: ['comments', {'posts': 'comments'}]}, function (err, user) {
    //     if (err) console.log(err);
    //     expect(user.id).to.be(userId);
    //     expect(user.posts).to.be.an('array');
    //     expect(user.posts.length).to.be(2);

    //     expect(user.posts[0].authorId).to.be(userId);

    //     done();
    //   });
    // });

    // it('should be able to fetch a user with their posts and comments (hasMany)', function (done) {
    //   User.mget([userId, 1], {includes: ['comments', {'posts': 'comments'}]}, function (err, users) {
    //     if (err) console.log(err);

    //     expect(users.length).to.be(2);
    //     expect(users[0].id).to.be(userId);
    //     expect(users[1].id).to.be(1);

    //     expect(users[0].posts.length).to.be(2);
    //     expect(users[1].posts.length).to.be(1);

    //     expect(users[1].comments.length).to.be(1);

    //     done();
    //   });
    // });

    // it('should be able to fetch a post and its author', function (done) {
    //   Post.get(1, {includes: {'author': 'posts'}}, function (err, post) {
    //     if (err) console.log(err);
    //     expect(post.author.id).to.be(userId);
    //     done();
    //   });
    // });
  });
});
