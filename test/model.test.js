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
        {name: 'age', type: 'integer'}
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
  }); //#mget

  describe('#save', function (done) {
    it('should save a new object', function (done) {
      Person.save({name: 'Jim'}, function (err, person) {
        console.log(err);
        console.log(person);
        done();
      });
    });

    it('should update and existing object', function (done) {
      Person.save({id: 1, revision: 1}, function (err, person) {
        console.log(err);
        console.log(person);
        done();
      });
    });
  });
});
