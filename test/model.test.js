var expect = require('expect.js')
  , helpers = require('./helpers')
  , sqlbox = require('../lib/sqlbox');

describe('sqlbox model', function () {

  var Person;

  beforeEach(function (done) {
    sqlbox.createClient(function (pg) {
      return new pg.Client('postgres://localhost/' + (process.env.DATABASE_NAME || process.env.USER));
    });

    Person = sqlbox.create({
      tableName: 'sqlbox_test_people',

      columns: [
        {name: 'name', type: 'string'},
        {name: 'age', type: 'integer'},
        {name: 'accountId', type: 'integer'}
      ],

      // logQueries: true
      validate: function (person, v) {
        v.check(person.age, 'Age must be provided').isInt();
      }
    });

    helpers.createPeopleTable(sqlbox.clients.default, done);
  });

  afterEach(function (done) {
    helpers.dropPeopleTable(sqlbox.clients.default, function () {
      sqlbox.removeClient();
      done();
    });
  });

  describe('#build', function () {
    it('should remove extra properties', function () {
      var person = Person.build({name: 'Jim', company: 'Example, Inc'});
      expect(person).to.eql({name: 'Jim'});
    });

    it('should convert source columns to name keys', function () {
      var person = Person.build({created_at: 1});
      expect(person.createdAt).to.be(1);
    });
  }); // #build

  describe('#get', function () {
    beforeEach(function (done) {
      Person.save({name: 'Jim', age: 25}, done);
    });

    it('should return an existing row', function (done) {
      Person.get(1, function (err, res) {
        expect(err).to.be(null);
        expect(res).to.be.an('object');
        expect(res.id).to.be(1);
        done();
      });
    });

    it('should return an error for non existing row', function (done) {
      Person.get(1000, function (err, res) {
        expect(err).to.be.an(Error);
        expect(res).to.be(undefined);
        done();
      });
    });
  }); // #get

  describe('#mget', function () {
    beforeEach(function (done) {
      Person.save({name: 'Jim', age: 25}, function () {});
      Person.save({name: 'Mark', age: 27}, done);
    });

    it('should return multiple existing rows', function (done) {
      Person.mget([1, 2], function (err, res) {
        expect(err).to.be(null);
        expect(res).to.be.an('array');
        expect(res.length).to.be(2);
        done();
      });
    });

    it('should return empty array when nothing is found', function (done) {
      Person.mget([1000, 1001], function (err, res) {
        expect(err).to.be(null);
        expect(res).to.be.an('array');
        expect(res.length).to.be(0);
        done();
      });
    });

    it('should return partial array when some rows are found', function (done) {
      Person.mget([1, 1000], function (err, res) {
        expect(err).to.be(null);
        expect(res).to.be.an('array');
        expect(res.length).to.be(1);
        done();
      });
    });

    it('should convert source columns to name', function (done) {
      Person.mget([1], function (err, res) {
        expect(res[0].createdAt).to.be.a(Date);
        done();
      });
    });
  }); //#mget

  describe('#save on a new object', function () {
    it('should save proper object', function (done) {
      Person.save({name: 'Jim', age: 25}, function (err, person) {
        expect(err).to.be(null);
        expect(person).to.be.an('object');
        expect(person.id).to.be.a('number');
        expect(person.revision).to.be(1);
        done();
      });
    });

    it('should pass 403 error on validation error', function (done) {
      Person.save({name: 'Jim'}, function (err, person) {
        expect(err).to.be.an(Error);
        expect(err.message).to.be('403');
        expect(err.validationErrors.length).to.be(1);
        done();
      });
    });
  }); // #save on a new object

  describe('#save on an existing object', function () {
    var person;

    beforeEach(function (done) {
      Person.save({name: 'Jim', age: 25}, function (err, p) {
        if (err) {
          return done(err);
        }

        person = p;
        done();
      });
    });

    it('should save an updated object', function (done) {
      person.age = 26;

      Person.save(person, function (err, updatedPerson) {
        expect(err).to.be(null);
        expect(updatedPerson).to.be.an('object');
        expect(updatedPerson.id).to.equal(person.id);
        expect(updatedPerson.age).to.equal(26);
        done();
      });
    });

    it('should reject an update if the revision does not match', function (done) {
      person.revision = 20;

      Person.save(person, function (err, updatedPerson) {
        expect(err).to.be.an(Error);
        expect(err.message).to.be('409');
        expect(updatedPerson).to.be(undefined);
        done();
      });
    });
  }); // #save on an existing object

  describe('#remove', function () {
    var person;

    beforeEach(function (done) {
      Person.save({name: 'Jim', age: 25}, function (err, p) {
        if (err) {
          return done(err);
        }

        person = p;
        done();
      });
    });

    it('should be able to remove a row', function (done) {
      Person.remove(person.id, function (err, result) {
        expect(err).to.be(null);
        expect(result).to.be(true);
        done();
      });
    });

    it('should return a 404 error when row not found', function (done) {
      Person.remove(person.id+1, function (err, result) {
        expect(err).to.be.an(Error);
        expect(err.message).to.be('404');
        expect(result).to.be(undefined);
        done();
      });
    });
  }); // #remove

  describe('#modify', function () {
    var person;

    beforeEach(function (done) {
      Person.save({name: 'Jim', age: 25}, function (err, p) {
        if (err) {
          return done(err);
        }

        person = p;
        done();
      });
    });

    it('should fetch and modify a row', function (done) {
      Person.modify(person.id, {}, function (person) {
        person.age = 26;
      }, function (err, updatedPerson) {
        expect(err).to.be(null);
        expect(updatedPerson.id).to.be(person.id);
        expect(updatedPerson.revision).to.be(person.revision + 1);
        expect(updatedPerson.age).to.be(26);
        done();
      });
    });

    it('should retry if conflict occurs', function (done) {
      var tries = 0;

      Person.modify(person.id, {}, function (dbPerson) {
        tries++;

        // This is just to change the revision in the database
        // during the first modify attempt. Simulates a conncurrent
        // update
        if (tries == 1) {
          person.name = 'Tim';
          Person.save(person, function () {});
        }

        dbPerson.age = 26;
      }, function (err, updatedPerson) {
        expect(tries).to.be(2);
        expect(updatedPerson.age).to.be(26);
        expect(updatedPerson.name).to.be('Tim');
        expect(updatedPerson.revision).to.be(person.revision + 2);
        done();
      });
    });

    it('should fail with 409 if ensure fails to match', function (done) {
      var opts = {
        ensures: [function (person) { person.age > 30; }]
      };

      Person.modify(person.id, opts, function (dbPerson) {
        dbPerson.age = 26;
      }, function (err, updatedPerson) {
        expect(err.message).to.be('409');
        expect(updatedPerson).to.be(undefined);
        done();
      });
    });

    it('should fail after too many retries', function (done) {
      var opts = {
        maxRetries: 2
      };

      var tries = 0;

      Person.modify(person.id, opts, function (dbPerson) {
        tries++;

        // This forces a retry, like a concurrent update keeps happening before
        // the fetch/mutate/save of modify happens.
        dbPerson.age++;
        Person.save(dbPerson, function () {});

        dbPerson.age = 26;
      }, function (err, updatedPerson) {
        expect(err.message).to.be('503');
        expect(updatedPerson).to.be(undefined);
        expect(tries).to.be(2);
        done();
      });
    });
  }); // #modify

  describe('#first', function () {
    var savedPerson;

    beforeEach(function (done) {
      Person.save({name: 'Tom', age: 32}, function () {});
      Person.save({name: 'Frank', age: 32}, function () {});
      Person.save({name: 'Jim', age: 25}, function (err, saved) {
        if (err) {
          return done(err);
        }

        savedPerson = saved;
        done();
      });
    });

    it('should find the first person that matches', function (done) {
      Person.first({age: 32}, function (err, person) {
        expect(err).to.be(null);
        expect(person.name).to.be('Tom');
        done();
      });
    });

    it('should find one by multiple fields', function (done) {
      Person.first({age: 25, name: 'Jim'}, function (err, person) {
        expect(err).to.be(null);
        expect(person).to.eql(savedPerson);
        done();
      });
    });

    it('should return a 404 error if nothing found', function (done) {
      Person.first({age: 40}, function (err, person) {
        expect(err).to.be.an(Error);
        expect(err.message).to.be('404');
        expect(person).to.be(undefined);
        done();
      });
    });
  });

  describe('#all', function () {
    var savedPerson;

    beforeEach(function (done) {
      Person.save({name: 'Tom', age: 32}, function () {});
      Person.save({name: 'Frank', age: 32}, function () {});
      Person.save({name: 'Jim', age: 25}, function (err, saved) {
        if (err) {
          return done(err);
        }

        savedPerson = saved;
        done();
      });
    });

    it('should find people that match a single field', function (done) {
      Person.all({age: 32}, function (err, people) {
        expect(err).to.be(null);
        expect(people.length).to.be(2);
        done();
      });
    });

    it('should find people that match multiple fields', function (done) {
      Person.all({age: 25, name: 'Jim'}, function (err, people) {
        expect(err).to.be(null);
        expect(people.length).to.be(1);
        expect(people[0]).to.eql(savedPerson);
        done();
      });
    });

    it('should pass an empty array when nothing found', function (done) {
      Person.all({age: 40}, function (err, people) {
        expect(err).to.be(null);
        expect(people.length).to.be(0);
        done();
      });
    });

    it('should be able to be sorted', function (done) {
      var idDesc = function (t) {
        return t.id.desc;
      }

      Person.all({age: 32}, {order: idDesc}, function (err, people) {
        expect(err).to.be(null);
        expect(people[0].name).to.be('Frank');
        expect(people[1].name).to.be('Tom');
        done();
      });
    });
  }); // #all

  describe('#query', function () {
    beforeEach(function (done) {
      Person.save({name: 'Tom', age: 32}, function () {});
      Person.save({name: 'Frank', age: 32}, function () {});
      Person.save({name: 'Jim', age: 25}, done);
    });

    it('should be able to query rows', function (done) {
      Person.query(function (t) {
        return t.where({age: 32});
      }, function (err, people) {
        expect(err).to.be(null);
        expect(people.length).to.be(2);
        done();
      });
    });
  }); // #query
});
