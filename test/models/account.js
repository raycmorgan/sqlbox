var sqlbox = require('../../lib/sqlbox');

var Account = sqlbox.create({
  name: 'account',
  namespace: 'test',
  
  columns: [
    {name: 'name'},
    {name: 'organizationId'}
  ],

  relations: [
    {type: 'hasOne', name: 'admin', foreignKey: 'organizationId', model: 'user'}
  ]
});

module.exports = Account;
