var sqlbox = require('../../lib/sqlbox');

var Organization = sqlbox.create({
  name: 'organization',
  namespace: 'test',
  
  columns: [
    {name: 'name'}
  ],

  relations: [
    {type: 'hasOne', name: 'admin', foreignKey: 'organizationId', model: 'user'},
    {type: 'hasOne', name: 'account', model: 'account'}
  ]
});

module.exports = Organization;
