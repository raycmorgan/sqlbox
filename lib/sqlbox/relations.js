var _ = require('underscore')
  , pluralize = require('pluralize');


function setup(box) {
  _.each(box.relations || [], function (relation) {
    if (!relation.foreignKey) {
      if (relation.type === 'belongsTo') {
        relation.foreignKey = pluralize(relation.name, 1) + 'Id';
      } else if (relation.type === 'hasMany') {
        relation.foreignKey = pluralize(box.tableName, 1) + 'Id';
      }
    }
  });
}


function includeQuery(box, includes) {
  return {
    query: includeQuery_(box.table, box, includes),
    order: includesQueryOrder(box, includes, [])
  } 
}

function includeQuery_(joinChain, joinToBox, include) {
  if (_.isString(include)) {
    return includeRelationQuery(joinChain, joinToBox, include);
  } else if (_.isArray(include)) {
    _.each(include, function (name) {
      joinChain = includeQuery_(joinChain, joinToBox, name);
    });
    return joinChain;
  } else if (_.isObject(include)) {
    _.each(include, function (nestedInclude, name) {
      joinChain = includeQuery_(joinChain, joinToBox, name);

      var relBox = _.findWhere(joinToBox.relations, {name: name}).model;
      joinChain = includeQuery_(joinChain, relBox, nestedInclude);
    });
    return joinChain;
  }
}

function includesQueryOrder(box, includes, order) {
  order = order || [];

  if (_.isString(includes)) {
    var relBox = _.findWhere(box.relations, {name: includes}).model;
    order.push({model: relBox, name: includes});
  } else if (_.isArray(includes)) {
    _.each(includes, function (include) {
      includesQueryOrder(box, include, order);
    });
  } else if (_.isObject(includes)) {
    _.each(includes, function (nestedInclude, name) {
      includesQueryOrder(box, name, order);

      var relBox = _.findWhere(box.relations, {name: name}).model;
      includesQueryOrder(relBox, nestedInclude, order);
    });
  }

  return order;
}

function includeRelationQuery(joinChain, joinToBox, name) {
  var relation = _.findWhere(joinToBox.relations, {name: name});
  var relModel = relation.model;
  var relTable = relModel.table.as(name);

  var query = joinChain.leftJoin(relTable);

  if (relation.type === 'hasMany') {
    var foreignKey = _.findWhere(relModel.columns, {name: relation.foreignKey}).source;
    query.on(joinToBox.table.id.equals(relTable[foreignKey]));
  } else if (relation.type === 'belongsTo') {
    var foreignKey = _.findWhere(joinToBox.columns, {name: relation.foreignKey}).source;
    query.on(relTable.id.equals(joinToBox.table[foreignKey]))
  }

  return query;
}


// var sqlbox = require('../sqlbox');

// var User = sqlbox.create({
//   tableName: 'users',
//   columns: [
//     {name: 'name'}
//   ],

//   relations: [
//     {type: 'hasMany', name: 'posts', foreignKey: 'authorId'},
//     {type: 'hasMany', name: 'editedPosts', foreignKey: 'editorId'},
//     {type: 'hasMany', name: 'comments'}
//   ]
// });

// var Post = sqlbox.create({
//   tableName: 'posts',
//   columns: [
//     {name: 'title'},
//     {name: 'authorId'},
//     {name: 'editorId'}
//   ],

//   relations: [
//     {type: 'belongsTo', name: 'author', model: User},
//     {type: 'belongsTo', name: 'editor', model: User},
//     {type: 'hasMany', name: 'comments'}
//   ]
// });

// var Comment = sqlbox.create({
//   // name: 'comment',
//   // namespace: 'condition'

//   tableName: 'comments',
//   columns: [
//     {name: 'userId'},
//     {name: 'postId'},
//     {name: 'content'}
//   ],

//   relations: [
//     {type: 'belongsTo', name: 'user', model: User},
//     {type: 'belongsTo', name: 'post', model: Post}
//   ]
// });


// _.findWhere(User.relations, {name: 'posts'}).model = Post;
// _.findWhere(User.relations, {name: 'editedPosts'}).model = Post;
// _.findWhere(User.relations, {name: 'comments'}).model = Comment;
// _.findWhere(Post.relations, {name: 'comments'}).model = Comment;



// setupRelations(User);
// setupRelations(Post);
// setupRelations(Comment);

// // console.log(includeQuery(Post, ['author', 'editor']).toString());
// // console.log(includeQuery(Comment, ['user', {'post': ['author', 'editor']}]).toString());

// console.log(includeQuery(User, ['editedPosts', {'posts': 'comments'}])) //.toString());



// User.get(1, {includes: [{'posts': 'comments'}, 'editedPosts']}, function () {});




exports.setup = setup;
exports.includeQuery = includeQuery;
