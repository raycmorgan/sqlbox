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

exports.createPeopleTable = createPeopleTable;
exports.dropPeopleTable = dropPeopleTable;
