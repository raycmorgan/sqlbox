var expect = require('expect.js')
  , helpers = require('./helpers')
  , sqlbox = require('../lib/sqlbox')
  , Person = require('./models/person');

describe('sqlbox model without client', function () {
  it('should throw a 500 error', function () {
    expect(function () {
      Person.get(1, function () {});
    }).to.throwException(function (err) {
      expect(err).to.be.an(Error);
    });
  });
});

describeModel('Postgres');
describeModel('MySQL');

function describeModel(driver) {
  var dbURL, user;

  if ('Postgres' === driver) {
    user = process.env.POSTGRES_USER ? process.env.POSTGRES_USER + ':@' : '';
    dbURL = 'postgres://' + user + 'localhost/' + (process.env.DATABASE_NAME || process.env.USER);
  }

  if ('MySQL' === driver) {
    user = process.env.MYSQL_USER ? process.env.MYSQL_USER + ':@' : 'root:@';
    dbURL = 'mysql://' + user + 'localhost/' + (process.env.DATABASE_NAME || process.env.USER);
  }

  describe(driver + ' sqlbox model', function () {

    beforeEach(function (done) {
      sqlbox.createClient({
        dbURL: dbURL,
        poolMin: 2,
        pooMax: 10
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
      it('should remove extra properties', function (done) {
        Person.build({name: 'Jim', company: 'Example, Inc'}, function (err, person) {
          expect(person).to.eql({name: 'Jim'});
          done();
        });
      });

      it('should convert source columns to name keys', function (done) {
        Person.build({created_at: 1}, function (err, person) {
          expect(person.createdAt).to.be(1);
          done();
        });
      });

      it('should run the afterFetch hook', function (done) {
        Person.build({age: 27, created_at: 1}, function (err, person) {
          expect(person.nextAge).to.be(28);
          done();
        });
      });
    }); // #build

    describe('#get', function () {
      beforeEach(function (done) {
        Person.save({name: 'Jim', age: 25, accountId: 0}, done);
      });

      it('should return an existing row', function (done) {
        Person.get(1, function (err, res) {
          expect(err).to.be(null);
          expect(res).to.be.an('object');
          expect(res.id).to.be(1);
          done();
        });
      });

      it('should return columns with falsey values correctly', function (done) {
        Person.get(1, function (err, res) {
          expect(err).to.be(null);
          expect(res).to.be.an('object');
          expect(res.accountId).to.be(0);
          done();
        });
      });

      it('should accept a query object in addition to an id', function (done) {
        Person.get({accoundId: 0}, function (err, res) {
          expect(err).to.be(null);
          expect(res).to.be.an('object');
          expect(res.name).to.be('Jim');
          expect(res.age).to.be(25);
          done();
        });
      })

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
          expect(err).to.not.be.ok();
          expect(res).to.be.an('array');
          expect(res.length).to.be(2);
          done();
        });
      });

      it('should return empty array when nothing is found', function (done) {
        Person.mget([1000, 1001], function (err, res) {
          expect(err).to.not.be.ok();
          expect(res).to.be.an('array');
          expect(res.length).to.be(0);
          done();
        });
      });

      it('should return partial array when some rows are found', function (done) {
        Person.mget([1, 1000], function (err, res) {
          expect(err).to.not.be.ok();
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
          expect(err).to.not.be.ok();
          expect(person).to.be.an('object');
          expect(person.id).to.be.a('number');
          done();
        });
      });

      it('should pass 403 error on validation error', function (done) {
        Person.save({name: 'Jim'}, function (err, person) {
          expect(err).to.be.an(Error);
          expect(err.code).to.be(403);
          expect(err.validationErrors.length).to.be(1);

          expect(err.validationErrors[0]).to.eql({
            key: 'age',
            value: undefined,
            expected: ['isInt', 'notNull'],
            failed: ['isInt', 'notNull']
          });

          done();
        });
      });

      it('should run the beforeSave hook', function (done) {
        Person.save({name: 'Jim', age: 25, password: 'foo'}, function (err, person) {
          expect(err).to.not.be.ok();
          expect(person.hashedPassword).to.be('bar');
          expect(person.password).to.be(undefined);
          done();
        });
      });

      it('should return a 409 when unique index fails', function (done) {
        Person.save({name: 'Jim', age: 25, password: 'foo'}, function (err, person) {
          expect(err).to.not.be.ok();

          Person.save({name: 'Jim', age: 26, password: 'foo'}, function (err, person) {
            expect(err.code).to.be(409);
            expect(err.conflicts).to.be.an('array');
            done();
          });
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
          expect(err).to.not.be.ok();
          expect(updatedPerson).to.be.an('object');
          expect(updatedPerson.id).to.equal(person.id);
          expect(updatedPerson.age).to.equal(26);
          done();
        });
      });

      it('should error 409 if where clause fails', function (done) {
        person.name = 'Frank';

        Person.save(person, {age: 30}, function (err, updatedPerson) {
          expect(err.code).to.be(409);
          expect(updatedPerson).to.be(undefined);
          done();
        });
      });

      it('should not perform update if no changes', function (done) {
        Person.save(person, function (err, updatedPerson) {
          expect(err).to.not.be.ok();
          expect(updatedPerson).to.eql(person);
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
          expect(err).to.not.be.ok();
          expect(result).to.be(true);
          done();
        });
      });

      it('should return a 404 error when row not found', function (done) {
        Person.remove(person.id+1, function (err, result) {
          expect(err).to.be.an(Error);
          expect(err.code).to.be(404);
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
          expect(updatedPerson.age).to.be(26);
          done();
        });
      });

      it('should pass back 409 error if where clause fails', function (done) {
        Person.modify(person.id, {name: 'Jim'}, function (dbPerson) {
          person.name = 'Tim';
          Person.save(person, function () {});

          dbPerson.age = 26;
        }, function (err, updatedPerson) {
          expect(err.code).to.be(409);
          done();
        });
      });

      it('should update if where passes even with concurrent update', function (done) {
        Person.modify(person.id, {age: 25}, function (dbPerson) {
          person.name = 'Tim';
          Person.save(person, function () {});

          dbPerson.age = 26;
        }, function (err, updatedPerson) {
          expect(err).to.be(null);
          expect(updatedPerson.name).to.be('Tim');
          expect(updatedPerson.age).to.be(26);
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

      it('should return a undefined error if nothing found', function (done) {
        Person.first({age: 40}, function (err, person) {
          expect(err).to.be(null);
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
          expect(err).to.not.be.ok();
          expect(people.length).to.be(2);
          done();
        });
      });

      it('should find people that match multiple fields', function (done) {
        Person.all({age: 25, name: 'Jim'}, function (err, people) {
          expect(err).to.not.be.ok();
          expect(people.length).to.be(1);
          expect(people[0]).to.eql(savedPerson);
          done();
        });
      });

      it('should find people with age greater than 30', function (done) {
        Person.all({age: {gt: 30}}, function (err, people) {
          expect(err).to.not.be.ok();
          expect(people[0].name).to.be('Tom');
          expect(people[1].name).to.be('Frank');
          done();
        });
      });

      it('should find people with age greater than 20, less than 32', function (done) {
        Person.all({age: {gt: 20, lt: 32}}, function (err, people) {
          expect(err).to.not.be.ok();
          expect(people[0].name).to.be('Jim');
          done();
        });
      });

      it('should find people with name not null', function (done) {
        Person.all({age: {not: null}}, function (err, people) {
          expect(err).to.not.be.ok();
          expect(people.length).to.be(3);
          done();
        });
      });

      it('should find people with names in an array', function (done) {
        Person.all({name: {in: ['Tom', 'Jim']}}, function (err, people) {
          expect(err).to.not.be.ok();
          expect(people.length).to.be(2);
          done();
        });
      });

      it('should pass an empty array when nothing found', function (done) {
        Person.all({age: 40}, function (err, people) {
          expect(err).to.not.be.ok();
          expect(people.length).to.be(0);
          done();
        });
      });

      it('should be able to be sorted', function (done) {
        Person.all({age: 32}, {order: {id: 'desc'}}, function (err, people) {
          expect(err).to.not.be.ok();
          expect(people[0].name).to.be('Frank');
          expect(people[1].name).to.be('Tom');
          done();
        });
      });

      it('should be able to select columns', function (done) {
        Person.all({age: 32}, {select: ['name']}, function (err, people) {
          expect(err).to.not.be.ok();
          expect(people[0].name).to.be('Tom');
          expect(people[0].id).to.be(undefined);
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
          expect(err).to.not.be.ok();
          expect(people.length).to.be(2);
          done();
        });
      });
    }); // #query
  });
}
