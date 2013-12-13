var _ = require('underscore');

function joinClause(model, query, includes) {
  if (_.isString(includes)) {
    
  }
}

function tableForRelation(model, relation) {
  return modelForRelation(model, realtion).table;
}

function modelForRelation(model, relation) {
  var relation = relationByName(model, relation);
  return model.registeredModels[model.namespace || 'GLOBAL'][relation.model];
}

function relationByName(model, relation) {
  return _.findWhere(model.relations, {name: relation});
}
