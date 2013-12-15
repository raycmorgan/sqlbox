var expect = require('expect.js')
  , helpers = require('./helpers')
  , sqlbox = require('../lib/sqlbox')
  , _ = require('underscore');

var User = require('./models/user')
  , Post = require('./models/post')
  , Comment = require('./models/comment');

function noop() {};

describeModel('Postgres');
describeModel('MySQL');

function describeModel(driver) {

  describe('Relations', function () {

    var userId, postId;
    var dbURL, dbUser;

    if ('Postgres' === driver) {
      dbUser = process.env.POSTGRES_USER ? process.env.POSTGRES_USER + ':@' : '';
      dbURL = 'postgres://' + dbUser + 'localhost/' + (process.env.DATABASE_NAME || process.env.USER);
    }

    if ('MySQL' === driver) {
      dbUser = process.env.MYSQL_USER ? process.env.MYSQL_USER + ':@' : 'root:@';
      dbURL = 'mysql://' + dbUser + 'localhost/' + (process.env.DATABASE_NAME || process.env.USER);
    }

    beforeEach(function (done) {
      user = process.env.POSTGRES_USER ? process.env.POSTGRES_USER + ':@' : '';

      sqlbox.createClient({
        dbURL: dbURL,
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

          postId = post.id;

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
      it('should be able to fetch a post and its author (belongsTo)', function (done) {
        Post.get(1, {include: 'author'}, function (err, post) {
          if (err) console.log(err);
          expect(post.author.id).to.be(userId);
          done();
        });
      });

      it('should be able to fetch an author and their posts (hasMany)', function (done) {
        User.get(userId, {include: 'posts'}, function (err, user) {
          if (err) console.log(err);
          expect(user.id).to.be(userId);
          expect(user.posts).to.be.an('array');
          done();
        });
      });

      it('should be able to fetch an author and their posts + comments (hasMany)', function (done) {
        User.get(userId, {include: ['posts', 'comments']}, function (err, user) {
          if (err) console.log(err);
          expect(user.id).to.be(userId);
          expect(user.posts).to.be.an('array');
          expect(user.comments).to.be.an('array');
          done();
        });
      });

      it('should be able to fetch author -> posts -> comments', function (done) {
        User.get(userId, {include: {posts: 'comments'}}, function (err, user) {
          if (err) console.log(err);
          expect(user.id).to.be(userId);
          expect(user.posts).to.be.an('array');
          expect(user.posts[0].comments).to.be.an('array');
          done();
        });
      });

      it('should be able to fetch user -> (comments, posts -> comments)', function (done) {
        User.get(userId, {include: ['comments', {posts: 'comments'}]}, function (err, user) {
          if (err) console.log(err);

          expect(user.id).to.be(userId);
          expect(user.posts).to.be.an('array');

          var post = _.findWhere(user.posts, {id: postId});
          expect(post).to.not.be(undefined);
          expect(post.comments.length).to.be(1);

          done();
        });
      });
    });
  });

}