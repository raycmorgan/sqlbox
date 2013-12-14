// ----------------------------------------------------------------------------
// Requirements
// ----------------------------------------------------------------------------

var _ = require('underscore')
  , assert = require('assert');

// ----------------------------------------------------------------------------
// Public Functions
// ----------------------------------------------------------------------------

function selectFromClause(model, query, select, include) {
  var chain = model.table.as(model.name);

  _.each(model.columns, function (c) {
    if (!select || _.contains(select, c.name)) {
      query = query.select(chain[c.source].as(c.name));
    }
  });

  if (include) {
    var statements = joinStatements(model, '', include);

    _.each(_.flatten(statements), function (s) {
      // For each joined table, select all the columns from that table. Each
      // column is prefixed with the relationship chain from the root model.
      _.each(s.model.columns, function (c) {
        query = query.select(columnAlias(s.table, c.source, c.name, s.type));
      });

      query.sqlboxModels = query.sqlboxModels || {};
      query.sqlboxModels[s.table.alias] = s.model;

      // Add the join statement to the from clause of the query.
      chain = chain.leftJoin(s.table).on(s.joinOn);
    });
  }

  query.from(chain);
  return query;
}


// ----------------------------------------------------------------------------
// Private Functions
// ----------------------------------------------------------------------------

function joinStatements(model, prefix, include) {
  if (_.isString(include)) {
    return [joinStatement(model, prefix, include)];
  }
  else if (_.isArray(include)) {
    // If include is an array, apply each object in the array back
    // over joinStatements.
    return _.map(include, _.partial(joinStatements, model, prefix));
  }
  else if (_.isObject(include)) {
    // If the include is an object, we need to join the keys of that object
    // and also join the values. The values however are joined with their
    // keys, so we just recurse further.
    return _.map(include, function (v, k) {
      var associatedModel = modelForRelation(model, k);

      return [
        joinStatements(model, prefix, k),
        joinStatements(associatedModel, prefixWithRelation(model, prefix, k), v)
      ];
    });
  }
}

function joinStatement(model, prefix, relationName) {
  var relation = relationByName(model, relationName);
  var associatedModel = modelForRelation(model, relationName);
  var associatedTable = tableForRelation(model, relationName).as(prefixWithRelation(model, prefix, relationName));

  var statement = {
    table: associatedTable,
    model: associatedModel,
    type: relation.type
  };

  switch (relation.type) {
    case 'hasMany':
      var fk = columnSource(associatedModel, relation.foreignKey);
      statement.joinOn = associatedTable[fk].equals(model.table.as(prefix || model.name).id);
      break;

    case 'belongsTo':
      var fk = columnSource(model, relation.foreignKey);
      statement.joinOn = associatedTable.id.equals(model.table.as(prefix || model.name)[fk]);
      break;
  }

  return statement;
}


// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function prefixWithRelation(model, prefix, relationName) {
  var relation = relationByName(model, relationName);
  var suffix = relation.name + (relation.type === 'hasMany' ? '[]' : '');

  return (prefix.length ? prefix + '.' : '') + suffix;
}

function columnAlias(table, columnSource, columnName, relationType) {
  var aliasName = null;

  switch (relationType) {
    case 'hasMany':
      // aliasName = table.alias + ':' + columnName + '[]'
      // break;

    case 'belongsTo':
      aliasName = table.alias + ':' + columnName
      break;
  }

  return table[columnSource].as(aliasName);
}

function columnSource(model, columnName) {
  var column = _.findWhere(model.columns, {name: columnName});

  assert(column, 'Column `' + columnName +
    '` not found in model `' + model.name + '`');

  return column.source;
}

function tableForRelation(model, relation) {
  return modelForRelation(model, relation).table;
}

function modelForRelation(model, relation) {
  var relation = relationByName(model, relation);
  var namespace = model.namespace || 'GLOBAL';
  var model = model.registeredModels[namespace][relation.model];

  assert(model, 'Model `' + namespace + ':' + relation.model + '` was not found.');

  return model;
}

function relationByName(model, relationName) {
  var relation = _.findWhere(model.relations, {name: relationName});

  assert(relation, 'Relation `' + relationName +
    '` is not defined on model `' + model.name + '`.');

  return relation;
}


// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

module.exports = selectFromClause;


// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

if (process.env.NODE_ENV !== 'test') return;

var User = require('../test/models/user')
  , Post = require('../test/models/post')
  , Comment = require('../test/models/comment');

var i = 1000;
var include = [
  {posts: 'editor'},
  {comments: {user: 'posts'}},
  'editedPosts'
];

console.log(selectFromClause(User, User.table, ['id'], include).toString());

console.time('test')
while(i--) selectFromClause(User, User.table, null, include).toQuery();
console.timeEnd('test')
