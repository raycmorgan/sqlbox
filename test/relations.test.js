var expect = require('expect.js')
  , helpers = require('./helpers')
  , sqlbox = require('../lib/sqlbox')
  , _ = require('underscore');

var User = require('./models/user')
  , Post = require('./models/post')
  , Account = require('./models/account')
  , Comment = require('./models/comment')
  , Organization = require('./models/organization');

function noop() {};

describeModel('Postgres');
describeModel('MySQL');

function describeModel(driver) {

  describe('Relations', function () {

    var userId, postId, organizationId;
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

      Organization.save({ name: 'SQLbox Corporation, Inc. LLC' }, function (err, org) {
        if (err) { return done(err); }
        organizationId = org.id;

        Account.save({name: 'Fancy Corp.', organizationId: organizationId}, noop);

        User.save({name: 'Tim'}, noop);
        User.save({name: 'John'}, noop);
        User.save({name: 'Frank', organizationId: organizationId}, function (err, user) {
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

      it('should be able to fetch an organization and its admin (hasOne)', function (done) {
        Organization.get(organizationId, {include: 'admin'}, function (err, org) {
          if (err) console.log(err);
          expect(org.id).to.be(organizationId);
          expect(org.admin).to.be.an('object');
          done();
        });
      });

      it('should be able to fetch an organization and its account (hasOne', function (done) {
        Organization.get(organizationId, {include: 'account'}, function (err, org) {
          if (err) console.log(err);
          expect(org.id).to.be(organizationId);
          expect(org.account).to.be.an('object');
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
    }); // end #get

    describe('#all', function () {
      it('should be able to fetch all posts and their authors', function (done) {
        Post.all({}, {include: 'author'}, function (err, posts) {
          if (err) console.log(err);

          expect(posts).to.be.an('array');
          posts.forEach(function (post) {
            expect(post.author).to.not.be(undefined);
            expect(post.author).to.be.an('object');
          });

          done();
        });
      });

      it('should be able to fetch users -> (comments, posts -> comments)', function (done) {
        User.all({}, {include: ['comments', {posts: 'comments'}]}, function (err, users) {
          if (err) console.log(err);

          expect(users).to.be.an('array');
          users.forEach(function (user) {
            expect(user.posts).to.be.an('array');
            user.posts.forEach(function (post) {
              expect(post.comments).to.be.an('array');
            });
          });

          done();
        });
      });
    }); // end #all

    describe('#mget', function () {
      it('should be able to fetch posts and their authors', function (done) {
        Post.mget([1, 2], {include: 'author'}, function (err, posts) {
          if (err) console.log(err);

          expect(posts).to.be.an('array');
          posts.forEach(function (post) {
            expect(post.author).to.be.an('object');
          });

          done();
        });
      });

      it('should be able to fetch author -> posts -> comments', function (done) {
        User.mget([userId, 2, 1], {include: {posts: 'comments'}}, function (err, users) {
          if (err) console.log(err);

          users.forEach(function (user) {
            expect(user.posts).to.be.an('array');
            user.posts.forEach(function (post) {
              expect(post.comments).to.be.an('array');
            });
          });

          done();
        });
      });
    }); // end #mget

  }); // end Relations

}