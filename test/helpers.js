function createPeopleTable(pg, callback) {
  pg.query('CREATE TABLE people (' +
    'id SERIAL PRIMARY KEY,' +
    'name VARCHAR,' +
    'age INTEGER,' +
    'accountId INTEGER,' +
    'created_at TIMESTAMP DEFAULT current_timestamp,' +
    'updated_at TIMESTAMP DEFAULT current_timestamp,' +
    'revision INTEGER DEFAULT 1' +
  ');', callback);
}

function dropPeopleTable(pg, callback) {
  pg.query('DROP TABLE IF EXISTS people;', callback);
}


exports.createPeopleTable = createPeopleTable;
exports.dropPeopleTable = dropPeopleTable;
