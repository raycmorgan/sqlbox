var async = require('async');

function createPeopleTable(client, callback) {
  client.query('CREATE TEMPORARY TABLE sqlbox_test_people (' +
    'id SERIAL PRIMARY KEY,' +
    'name VARCHAR(32) UNIQUE,' +
    'age INTEGER,' +
    'account_id INTEGER,' +
    'hashed_password TEXT,' +
    'created_at TIMESTAMP,' +
    'updated_at TIMESTAMP,' +
    'revision INTEGER DEFAULT 1' +
  ');', callback);
}

function dropPeopleTable(client, callback) {
  client.query('DROP TABLE IF EXISTS sqlbox_test_people;', callback);
}


function createModelTables(pg, callback) {
  async.series([
    createOrganizationTable.bind({}, pg),
    createAccountTable.bind({}, pg),
    createUserTable.bind({}, pg),
    createPostTable.bind({}, pg),
    createCommentTable.bind({}, pg),
    createPeopleTable.bind({}, pg),
  ], callback);
}

function dropModelTables(pg, callback) {
  pg.query(
    'DROP TABLE IF EXISTS test_organizations;' +
    'DROP TABLE IF EXISTS test_accounts;' +
    'DROP TABLE IF EXISTS test_users;' +
    'DROP TABLE IF EXISTS test_posts;' +
    'DROP TABLE IF EXISTS test_comments;' +
    'DROP TABLE IF EXISTS sqlbox_test_people;'
  , callback);
}

function createOrganizationTable(pg, callback) {
  pg.query('CREATE TEMPORARY TABLE test_organizations (' +
    'id SERIAL PRIMARY KEY,' +
    'created_at TIMESTAMP,' +
    'updated_at TIMESTAMP,' +
    'name TEXT' +
  ');', callback);
}

function createAccountTable(pg, callback) {
  pg.query('CREATE TEMPORARY TABLE test_accounts (' +
    'id SERIAL PRIMARY KEY,' +
    'created_at TIMESTAMP,' +
    'updated_at TIMESTAMP,' +
    'name TEXT,' +
    'organization_id INTEGER' +
  ');', callback);
}

function createUserTable(pg, callback) {
  pg.query('CREATE TEMPORARY TABLE test_users (' +
    'id SERIAL PRIMARY KEY,' +
    'created_at TIMESTAMP,' +
    'updated_at TIMESTAMP,' +
    'name TEXT,' +
    'organization_id INTEGER' +
  ');', callback);
}

function createPostTable(pg, callback) {
  pg.query('CREATE TEMPORARY TABLE test_posts (' +
    'id SERIAL PRIMARY KEY,' +
    'created_at TIMESTAMP,' +
    'updated_at TIMESTAMP,' +
    'title TEXT,' +
    'author_id INTEGER,' +
    'editor_id INTEGER' +
  ');', callback);
}

function createCommentTable(pg, callback) {
  pg.query('CREATE TEMPORARY TABLE test_comments (' +
    'id SERIAL PRIMARY KEY,' +
    'created_at TIMESTAMP,' +
    'updated_at TIMESTAMP,' +
    'content TEXT,' +
    'user_id INTEGER,' +
    'post_id INTEGER' +
  ');', callback);
}

exports.createPeopleTable = createPeopleTable;
exports.dropPeopleTable = dropPeopleTable;

exports.createModelTables = createModelTables;
exports.dropModelTables = dropModelTables;
