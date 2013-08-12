function createPeopleTable(pg, callback) {
  console.log('Creating table');
  pg.query('CREATE TABLE people (' +
    'id SERIAL PRIMARY KEY,' +
    'name VARCHAR,' +
    'age INTEGER,' +
    'created_at TIMESTAMP DEFAULT current_timestamp,' +
    'updated_at TIMESTAMP DEFAULT current_timestamp,' +
    'revision INTEGER DEFAULT 1' +
  ');', callback);
}

function dropPeopleTable(pg, callback) {
  console.log('Dropping table');
  pg.query('DROP TABLE IF EXISTS people;', callback);
}


exports.createPeopleTable = createPeopleTable;
exports.dropPeopleTable = dropPeopleTable;
