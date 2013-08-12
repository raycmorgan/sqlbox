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
      tableName: 'people',

      columns: [
        {name: 'name', type: 'string'},
        {name: 'age', type: 'integer'},
        {name: 'accountId', type: 'integer'}
      ]
    });

    helpers.createPeopleTable(sqlbox.clients.default, done);
  });

  afterEach(function (done) {
    helpers.dropPeopleTable(sqlbox.clients.default, function () {
      sqlbox.removeClient();
      done();
    });
  });

  describe('#get', function (done) {
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

  describe('#mget', function (done) {
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

  describe('#save on a new object', function (done) {
    it('should save proper object', function (done) {
      Person.save({name: 'Jim'}, function (err, person) {
        expect(err).to.be(null);
        expect(person).to.be.an('object');
        expect(person.id).to.be.a('number');
        expect(person.revision).to.be(1);
        done();
      });
    });
  }); // #save on a new object

  describe('#save on an existing object', function (done) {
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
  });
});
