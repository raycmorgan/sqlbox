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
    'updated_at TIMESTAMP DEFAULT current_timestamp,' +
    'revision INTEGER DEFAULT 1' +
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
    'DROP TABLE IF EXISTS users;' +
    'DROP TABLE IF EXISTS posts;' +
    'DROP TABLE IF EXISTS comments;'
  , callback);
}

function createUserTable(pg, callback) {
  pg.query('CREATE TEMP TABLE users (' +
    'id SERIAL PRIMARY KEY,' +
    'created_at TIMESTAMP DEFAULT current_timestamp,' +
    'updated_at TIMESTAMP DEFAULT current_timestamp,' +
    'revision INTEGER DEFAULT 1,' +
    'name TEXT' +
  ');', callback);
}

function createPostTable(pg, callback) {
  pg.query('CREATE TEMP TABLE posts (' +
    'id SERIAL PRIMARY KEY,' +
    'created_at TIMESTAMP DEFAULT current_timestamp,' +
    'updated_at TIMESTAMP DEFAULT current_timestamp,' +
    'revision INTEGER DEFAULT 1,' +
    'title TEXT,' +
    'authorId INTEGER,' +
    'title INTEGER' +
  ');', callback);
}

function createCommentTable(pg, callback) {
  pg.query('CREATE TEMP TABLE comments (' +
    'id SERIAL PRIMARY KEY,' +
    'created_at TIMESTAMP DEFAULT current_timestamp,' +
    'updated_at TIMESTAMP DEFAULT current_timestamp,' +
    'revision INTEGER DEFAULT 1,' +
    'content TEXT,' +
    'userId INTEGER,' +
    'postId INTEGER' +
  ');', callback);
}


exports.createPeopleTable = createPeopleTable;
exports.dropPeopleTable = dropPeopleTable;

exports.createModelTables = createModelTables;
exports.dropModelTables = dropModelTables;
