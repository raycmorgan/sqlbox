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


exports.createPeopleTable = createPeopleTable;
exports.dropPeopleTable = dropPeopleTable;
