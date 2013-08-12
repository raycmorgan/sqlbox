var expect = require('expect.js')
  , sqlbox = require('../lib/sqlbox');

describe('sqlbox model', function () {

  var Person;

  beforeEach(function () {
    sqlbox.createDatabase(function (pg) {
      return new pg.Client('postgres://localhost/ray');
    });

    Person = sqlbox.create({
      tableName: 'people'
    });
  });

  afterEach(function () {
    sqlbox.removeDatabase();
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
});
