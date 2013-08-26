var async = require('async')
  , User = require('./models/user')
  , Post = require('./models/post')
  , Comment = require('./models/comment');

function createPeopleTable(pg, callback) {
  pg.query('CREATE TEMP TABLE sqlbox_test_people (' +
    'id SERIAL PRIMARY KEY,' +
    'name TEXT,' +
    'age INTEGER,' +
    'accountId INTEGER,' +
    'hashed_password TEXT,' +
    'created_at TIMESTAMP DEFAULT current_timestamp,' +
    'updated_at TIMESTAMP DEFAULT current_timestamp' +
  ');', callback);
}

function dropPeopleTable(pg, callback) {
  pg.query('DROP TABLE IF EXISTS sqlbox_test_people;', callback);
}


function createModelTables(pg, callback) {
  async.series([
    createUserTable.bind({}, pg),
    createPostTable.bind({}, pg),
    createCommentTable.bind({}, pg),
  ], callback);
}

function dropModelTables(pg, callback) {
  pg.query(
    'DROP TABLE IF EXISTS test_users;' +
    'DROP TABLE IF EXISTS test_posts;' +
    'DROP TABLE IF EXISTS test_comments;'
  , callback);
}

function createUserTable(pg, callback) {
  pg.query('CREATE TEMP TABLE test_users (' +
    'id SERIAL PRIMARY KEY,' +
    'created_at TIMESTAMP DEFAULT current_timestamp,' +
    'updated_at TIMESTAMP DEFAULT current_timestamp,' +
    'name TEXT' +
  ');', callback);
}

function createPostTable(pg, callback) {
  pg.query('CREATE TEMP TABLE test_posts (' +
    'id SERIAL PRIMARY KEY,' +
    'created_at TIMESTAMP DEFAULT current_timestamp,' +
    'updated_at TIMESTAMP DEFAULT current_timestamp,' +
    'title TEXT,' +
    'author_id INTEGER,' +
    'editor_id INTEGER' +
  ');', callback);
}

function createCommentTable(pg, callback) {
  pg.query('CREATE TEMP TABLE test_comments (' +
    'id SERIAL PRIMARY KEY,' +
    'created_at TIMESTAMP DEFAULT current_timestamp,' +
    'updated_at TIMESTAMP DEFAULT current_timestamp,' +
    'content TEXT,' +
    'user_id INTEGER,' +
    'post_id INTEGER' +
  ');', callback);
}


exports.createPeopleTable = createPeopleTable;
exports.dropPeopleTable = dropPeopleTable;

exports.createModelTables = createModelTables;
exports.dropModelTables = dropModelTables;
