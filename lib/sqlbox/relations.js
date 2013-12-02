'use strict';

// ----------------------------------------------------------------------------
// Requirements
// ----------------------------------------------------------------------------

var _ = require('underscore')
  , assert = require('assert')
  , pluralize = require('pluralize')
  , sqlbox = require('../sqlbox');

// ----------------------------------------------------------------------------
// Public functions
// ----------------------------------------------------------------------------

function setup(model) {
  _.each(model.relations || [], function (relation) {
    if (!_.contains(['hasMany', 'belongsTo'], relation.type)) {
      throw new Error('The relation type ' + relation.type + ' for model `' +
        model.name + '` relation `' + relation.name + '` is not supported.');
    }

    if (!relation.foreignKey) {
      if (relation.type === 'belongsTo') {
        relation.foreignKey = pluralize.singular(relation.name) + 'Id';        
      } else if (relation.type === 'hasMany') {
        relation.foreignKey = pluralize.singular(model.name) + 'Id';
      }
    }
  });
}

function includeQuery(model, includes) {
  var modelAsName = pluralize(model.name);
  var joinTree = buildJoinTree(model, modelAsName, includes);
  var joinPath = _.flatten(joinTree);

  var query = _.reduce(joinPath, function (query, join) {
    return query
            .leftJoin(join.table.as(join.name))
            .on(join.on);
  }, model.table.as(modelAsName));

  joinPath.unshift({
    name: modelAsName,
    relation: 'owner',
    model: model
  });

  return {
    query: query,
    tableMap: joinPath
  };
}

// ----------------------------------------------------------------------------
// Private functions
// ----------------------------------------------------------------------------

function buildJoinTree(model, modelAsName, includes) {
  if (_.isString(includes)) {
    return [joinQuery(model, modelAsName, includes)];
  }
  else if (_.isArray(includes)) {
    return _.map(includes, function (relationName) {
      return buildJoinTree(model, modelAsName, relationName);
    });
  }
  else if (_.isObject(includes)) {
    return _.map(includes, function (nestedIncludes, relationName) {
      var relModel = relationModelByName(model, relationName);

      return [
        joinQuery(model, modelAsName, relationName),
        buildJoinTree(relModel, modelAsName + '.' + relationName, nestedIncludes)
      ];
    });
  }
}

function joinQuery(model, modelAsName, relationName) {
  var relation = relationByName(model, relationName);
  var relModel = relationModelByName(model, relationName);

  var join = {
    model: relModel,
    table: relModel.table.as(modelAsName + '.' + relationName),
    name: modelAsName + '.' + relationName,
    relation: relation.type
  };

  if (relation.type === 'hasMany') {
    var foreignKey = foreignKeySourceByRelation(relModel, relation, model.name);
    join.on = model.table.as(modelAsName).id.equals(join.table[foreignKey]);
  }
  else if (relation.type === 'belongsTo') {
    var foreignKey = foreignKeySourceByRelation(model, relation);
    join.on = join.table.id.equals(model.table.as(modelAsName)[foreignKey]);
  }
  else {
    console.error('Unhandled relation type:', relation.type);
  }

  return join;
}

function foreignKeySourceByRelation(model, relation, fromModel) {
  var foreignKey = _.findWhere(model.columns, {name: relation.foreignKey});
  assert(foreignKey, 'Model `' + model.name + '` must have the column `' + relation.foreignKey +
                     '` for the relation `' + (fromModel || model.name) + '` ' + relation.type + ' `' + relation.name + '`');

  return foreignKey.source;
}

function relationByName(model, name) {
  var relation = _.findWhere(model.relations, {name: name});
  assert(relation, model.name + ' does not contain the relation `' + name + '`');

  return relation;
}

function relationModelByName(model, name) {
  var relation = relationByName(model, name);
  var relModel, namespace;

  if (relation.namespace) {
    namespace = relation.namespace;
    relModel = sqlbox.models[relation.namespace][relation.model];
  }
  else if (model.namespace) {
    namespace = model.namespace;
    relModel = sqlbox.models[model.namespace][relation.model];
  }
  else {
    relModel = sqlbox.models[relation.model];
  }

  assert(relModel, 'The associated model `' + (namespace ? namespace + ':' : '') + name +
                   '` for the relation `' + model.name + '` ' + relation.type + ' `' + relation.name + '` was not found.');

  return relModel;
}

// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

exports.setup = setup;
exports.includeQuery = includeQuery;



// SELECT *
// FROM "test_users" AS "users"
//   LEFT JOIN "test_posts" AS "users.posts" ON ("users"."id" = "users.posts"."author_id")
//   LEFT JOIN "test_comments" AS "users.posts.comments" ON ("users.posts"."id" = "users.posts.comments"."post_id")
// WHERE ("users"."id" = 3);


