var expect = require('expect.js')
  , sqlbox = require('../lib/sqlbox');

describe('sqlbox module', function () {

  describe('#create', function () {
    it('should be a function', function () {
      expect(sqlbox.create).to.be.a('function');
    });

    it('should return an object', function () {
      expect(sqlbox.create({
        name: 'foo'
      })).to.be.a('object');
    });

    it('should throw an exception when no tableName is specified', function () {
      expect(sqlbox.create).to.throwException('sqlbox.create must be supplied a tableName property');
    });
  }); // #create

  describe('Private Function', function () {

    describe('#appendIdentifierColumn', function () {
      it('should create a new array with the new columns', function () {
        var columns = [{name: 'age'}];
        var updatedColumns = sqlbox.appendIdentifierColumn(columns);

        expect(updatedColumns).to.eql([
          {name: 'age'},
          {name: 'id', type: 'integer'}
        ]);

        expect(updatedColumns).to.not.eql(columns);
      });
    }); // #appendIdentifierColumn

    describe('#appendTimestampColumns', function () {
      it('should create a new array with the new columns', function () {
        var columns = [{name: 'id'}];
        var updatedColumns = sqlbox.appendTimestampColumns(columns);

        expect(updatedColumns).to.eql([
          {name: 'id'},
          {name: 'createdAt', type: 'date'},
          {name: 'updatedAt', type: 'date'}
        ]);

        expect(updatedColumns).to.not.eql(columns);
      });
    }); // #appendTimestampColumns

    describe('#standardizeColumns', function () {
      it('should create a new array with the updated columns', function () {
        var columns = [{name: 'id'}];
        var updatedColumns = sqlbox.standardizeColumns(columns);

        expect(updatedColumns).to.eql([
          {name: 'id', source: 'id'},
        ]);

        expect(updatedColumns).to.not.eql(columns);
      });

      it('should underscore column names when setting the source', function () {
        var columns = [{name: 'userId'}];
        var updatedColumns = sqlbox.standardizeColumns(columns);

        expect(updatedColumns).to.eql([
          {name: 'userId', source: 'user_id'},
        ]);
      });
    }); // #standardizeColumns

    describe('#toUnderscore', function () {
      it('should properly underscore camelcase strings', function () {
        expect(sqlbox.toUnderscore('someThing')).to.equal('some_thing');
        expect(sqlbox.toUnderscore('SomeThing')).to.equal('some_thing');
      });
    }); // #toUnderscore

    describe('#defineTable', function () {
      it('should define a table using the source fields', function () {
        var table = sqlbox.defineTable('people', [
          {name: 'id', source: 'id'},
          {name: 'userId', source: 'user_id'}
        ]);

        expect(table).to.be.an('object');
      });
    }); // #defineTable

    describe('#constructTableName', function () {
      it('should return tableName directly if supplied', function () {
        var model = {name: 'Person', tableName: 'myCustom_table_name'};
        expect(sqlbox.constructTableName(model)).to.equal(model.tableName);
      });

      it('should return the plural, lowercase form of name', function () {
        var model = {name: 'Person'};
        expect(sqlbox.constructTableName(model)).to.equal('people');
      });

      it('should prepend underscored,lowercase namespace', function () {
        var model = {name: 'Person', namespace: 'MyApp'};
        expect(sqlbox.constructTableName(model)).to.equal('my_app_people');        
      });
    }); // #constructTableName

  }); // Private Function

}); // sqlbox module
