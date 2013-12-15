// ----------------------------------------------------------------------------
// Requirements
// ----------------------------------------------------------------------------

var _ = require('underscore')
  , assert = require('assert')
  , pluralize =require('pluralize');


// ----------------------------------------------------------------------------
// Public Functions
// ----------------------------------------------------------------------------

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

function foreignKeyForRelation(model, relationName) {
  var relation = relationByName(model, relationName);

  if (relation.foreignKey) {
    return relation.foreignKey;
  }

  switch (relation.type) {
    case 'belongsTo': return relation.name + 'Id';
    case 'hasMany': return model.name + 'Id';
  }
}


// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

exports.columnSource = columnSource;
exports.tableForRelation = tableForRelation;
exports.modelForRelation = modelForRelation;
exports.relationByName = relationByName;
exports.foreignKeyForRelation = foreignKeyForRelation;
