'use strict';

// ----------------------------------------------------------------------------
// Requirements
// ----------------------------------------------------------------------------

var _ = require('underscore')
  , pluralize = require('pluralize')
  , sqlbox = require('../sqlbox');

// ----------------------------------------------------------------------------
// Public functions
// ----------------------------------------------------------------------------

function setup(model) {
  _.each(model.relations || [], function (relation) {
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

  // console.log(joinPath);

  var query = _.reduce(joinPath, function (query, join) {
    return query
            .leftJoin(join.table.as(join.name))
            .on(join.on);
  }, model.table.as(modelAsName));

  return {
    query: query,
    tableMap: [{name: modelAsName, relation: 'owner'}].concat(_.map(joinPath, function (join) {
      return {name: join.name, relation: join.relation};
    }))
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
  var relation = _.findWhere(model.relations, {name: relationName});
  var relModel = relationModelByName(model, relationName);

  var join = {
    table: relModel.table.as(modelAsName + '.' + relationName),
    name: modelAsName + '.' + relationName,
    relation: relation.type
  };

  if (relation.type === 'hasMany') {
    var foreignKey = _.findWhere(relModel.columns, {name: relation.foreignKey}).source;
    join.on = model.table.as(modelAsName).id.equals(join.table[foreignKey]);
  }
  else if (relation.type === 'belongsTo') {
    var foreignKey = _.findWhere(model.columns, {name: relation.foreignKey}).source;
    join.on = join.table.id.equals(model.table.as(modelAsName)[foreignKey]);
  }
  else {
    console.error('Unhandled relation type:', relation.type);
  }

  return join;
}

function relationModelByName(model, name) {
  var relation = _.findWhere(model.relations, {name: name});

  if (relation.namespace) {
    return sqlbox.models[relation.namespace][relation.model];
  }
  else if (model.namespace) {
    return sqlbox.models[model.namespace][relation.model];
  }
  else {
    return sqlbox.models[relation.model];
  }
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


