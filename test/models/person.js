var sqlbox = require('../../lib/sqlbox');

// ----------------------------------------------------------------------------
// Model
// ----------------------------------------------------------------------------

var Person = sqlbox.create({
  name: 'person',
  namespace: 'sqlboxTest',

  columns: [
    {name: 'name', type: 'string'},
    {name: 'age', type: 'integer'},
    {name: 'accountId', type: 'integer'},
    {name: 'hashedPassword', type: 'string'}
  ],

  validations: {
    age: ['isInt', 'notNull']
  },

  // logQueries: true,

  hooks: {
    beforeValidation: function (person, next) {
      if (person.password === 'foo') {
        person.hashedPassword = 'bar';
      }
      next();
    },

    afterFetch: function (person, next) {
      if (person.age) {
        person.nextAge = person.age + 1;
      }
      next();
    }
  }
});


// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

module.exports = exports = Person;
