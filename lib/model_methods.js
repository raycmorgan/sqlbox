'use strict';

// ----------------------------------------------------------------------------
// Requirements
// ----------------------------------------------------------------------------

var _ = require('underscore')
  , async = require('async')
  , BoxError = require('./box_error')
  , Validator = require('validator').Validator
  , assert = require('assert')
  , helpers = require('./model_helpers')
  , dialect;


// ----------------------------------------------------------------------------
// Public Functions
// ----------------------------------------------------------------------------

/**
  General Note:
  When using these public functions through a model instance (sqlbox.create)
  you do not specify the first "box" param. The model will auto-fill that in.

  Example:

    var Person = sqlbox.create({
      tableName: 'people'
    });

    Person.get(1, function (err, person) {
      // ...
    });

  This allows you to .bind, .call, or .apply without worrying about `this`
  being messed with.

  You can also interact directly with these methods if you need to:

    // This is the same as above
    model.get(People, 1, function (err, person) {
      // ...
    });
**/


/**
 * Builds a obj that conforms to the column spec defined in the model. Removes
 * all excess properties.
 *
 * @param model Object The model that defines the column spec
 * @param obj Object The data to transform
 * @param callback Function(err Error, obj Object)
 * @returns null
 */
function build(model, obj, callback) {
  var instance = pruneToColumns(model, obj);
  
  // Define a non-enumerable $meta property on the instance. This is used
  // for book keeping and extra properties that should be passed around with
  // the data.
  Object.defineProperty(instance, '$meta', {
    value: {},
    enumerable: false
  });
  
  // Save a clone of the data in its meta. This allows comparing changed objects
  // to what they originally where.
  instance.$meta.original = pruneToColumns(model, instance);
  
  runHooks(model, instance, ['afterFetch'], callback);
}


/**
 * Get a single row from a table by its id. Callback is optional. When it is
 * not specified a partially applied `get` function will be returned.
 *
 * Example of partial application:
 *
 *   var getOne = People.get(1);
 *   getOne(function (err, person) { ... });
 *
 * This is super useful when used with something like the async library.
 *
 * @param model Object The model instance. This parameter is not specified when
 *        using the method through a model instance
 * @param idOrQuery Number|Object The id of the row to fetch or a query
 *        object
 * @param [opts] Object
 * @param [callback] Function(err Error, row Object)
 * 
 * @returns null|Function null if a callback was specified else a partially
 *          applied version of `get` is returned.
 */
function get(model, idOrQuery, opts, callback) {
  // Shift around the arguments to allow optional opts
  if (arguments.length === 2) {
    opts = {};
  } else if (arguments.length === 3 && typeof arguments[2] === 'function') {
    callback = arguments[2];
    opts = {};
  }

  // If there is no callback, return a partially applied function
  if (!callback) {
    return _.partial(get, model, idOrQuery, opts);
  }

  var query;
  if (typeof idOrQuery === 'object') {
    query = idOrQuery;
  } else {
    query = {id: Number(idOrQuery)};
  }

  opts.limit = 1;
  opts.skip = 0;

  model.first(query, opts, function get_(err, object) {
    if (err) {
      return callback(err);
    }

    if (!object) {
      var msg = 'Row with id ' + idOrQuery + ' was not found in ' + model.name;
      return callback(new BoxError(404, msg));
    }

    callback(null, object);
  });

  // // TODO: look into providing a dev mode that captures the stack that called
  // //       into the model methods. This works, though maybe domains are better.
  // // var stackCapture = BoxError.stackCapture();
}


/**
 * Get multiple rows from a table by their ids. Uses the sql IN operator. Like
 * `get`, this also returns a partially applied function of itself if the
 * callback is not specified.
 *
 * @param model Object The model instance. This parameter is not specified when
 *        using the method through a model instance
 * @param ids Array The ids of the rows to fetch
 * @param [opts] Object
 * @param [callback] Function(err Error, rows Array)
 * 
 * @returns null|Function null if a callback was specified else a partially
 *          applied version of `get` is returned.
 */
function mget(model, ids, opts, callback) {
  // Shift around the arguments to allow optional opts
  if (arguments.length === 2) {
    opts = {};
  } else if (arguments.length === 3 && typeof arguments[2] === 'function') {
    callback = arguments[2];
    opts = {};
  }

  // If there is no callback, return a partially applied function
  if (!callback) {
    return _.partial(mget, model, ids, opts);
  }

  model.all({id: {in: _.map(ids, Number)}}, opts, callback);
}


/**
 * Saves a new or updated row into the database based on the model information.
 * Like `get`, this also returns a partially applied function of itself if the
 * callback is not specified.
 *
 * @param model Object The model instance. This parameter is not specified when
 *        using the method through a model instance 
 * @param obj Object The data to save or update to the database
 * @param [where] Object A where clause the update must match against
 * @param [callback] Function(err Error, savedRow Object)
 *
 * @returns null|Function null if a callback was specified else a partially
 *          applied version of `save` is returned.
 */
function save(model, obj, where, mainCallback) {
  // Shift around the arguments to allow optional where
  if (arguments.length === 2) {
    where = {};
  } else if (arguments.length === 3 && typeof arguments[2] === 'function') {
    mainCallback = arguments[2];
    where = {};
  }

  if (!mainCallback) {
    return _.partial(save, model, obj, where);
  }

  // Clone the object so any destruction done within save is not relayed back
  // to the original obj. This is super useful when mutating the object in a
  // hook, but then the save fails. You expect to still have the same object.
  var clone = cloneObject(obj);

  // Make sure the clone has the $meta feild of obj
  if ('$meta' in obj) {
    Object.defineProperty(clone, '$meta', {
      value: obj.$meta,
      enumerable: false
    });
  }

  // Perform the transaction and the save/update sequence
  async.series({
    beginTxn: _.bind(model.client.query, model.client, 'BEGIN'),
    beforeValidation: _.partial(runHook, model, clone, 'beforeValidation'),
    validation: _.partial(validate, model, clone),
    afterValidation: _.partial(runHook, model, clone, 'afterValidation'),

    hasChanges: function (callback) {
      // If the object was not changed, we do not want to update it in the
      // database. To skip further execution we return a 304 (not modified)
      // which signals that there is nothing further to do. No error will
      // be returned to the user.

      if (model.hasChanges(clone)) {
        return callback();
      } else {
        return callback(new BoxError(304));
      }
    },

    beforeSave: _.partial(runHook, model, clone, 'beforeSave'),
    saved: function (callback) {
      // If the obj has an id, we assume it is not new, this might be a good
      // place to utilize $meta.
      if (clone.id) {
        saveUpdate(model, clone, where, callback);
      } else {
        saveNew(model, clone, callback);
      }
    },
    commitTxn: _.bind(model.client.query, model.client, 'COMMIT')
  }, function (err, results) {
    // If there is an error, we need to roll the transaction back
    if (err) {
      model.client.query('ROLLBACK', function(err, result) {

      });
    }

    // If the error is 304, we just return the unchanged clone
    if (err && err.code === 304) {
      return mainCallback(null, clone);
    }

    // Transform unique index conflicts into a 409 conflict error
    if (err && dialect.isDupEntryError(err)) {
      var error = new BoxError(409, 'Duplicate key violates unique constraint.');

      var parsedDetail = dialect.parseDupEntryError(err);

      if (parsedDetail) {
        error.conflicts = [{
          key: parsedDetail[0],
          value: parsedDetail[1],
          expected: 'unique'
        }];
      }

      return mainCallback(error);
    }

    // Pass back any other error
    if (err) {
      return mainCallback(err);
    }

    // Hopefully nothing was wrong, in that case we pass back the result
    mainCallback(null, results.saved);
  });
}


/**
 * Remove a row from the database.
 *
 * @param model Object The model instance. This parameter is not specified when
 *        using the method through a model instance 
 * @param id Number The id of the row to remove
 * @param [callback] Function(err Error, success Boolean)
 *
 * @returns null|Function null if a callback was specified else a partially
 *          applied version of `remove` is returned.
 */
function remove(model, id, callback) {
  if (!callback) {
    return _.partial(remove, model, id);
  }

  var query = dialect.getDeleteQuery(model, id);

  if (model.logQueries) {
    console.log(query.text);
  }

  model.client.query(query.text, query.values, function remove_(err, result) {
    if (err) {
      return callback(err);
    }

    if (dialect.getRemovedRowCount(result)) {
      callback(null, true);
    } else {
      var msg = 'Row with id ' + id + ' was not found in ' + model.name;
      callback(new BoxError(404, msg));
    }
  });
}


/**
 * Modify is a higher level function that helps with the get/save loop. It
 * manages retrying saves if another actor updates the row being modified,
 * handles rules around what a valid object to update looks like (ensures),
 * and in general is a simpler, less nested way to mutate a row.
 *
 * @param model Object The model instance. This parameter is not specified when
 *        using the method through a model instance 
 * @param id Number The id of the row to modify
 * @param where Object The where clause to match against, if this fails a
 *        409 is passed back
 * @param mutator Function(obj Object) A function that takes the fetched
 *        database row and is responsible for changing it. This function
 *        may be ran multiple times on save conflicts, so should not have any
 *        side effects
 * @param [callback] Function(err Error, obj Object) The function that will be
 *        called after a successful update or after too many retries. The obj
 *        will reflect the new row in teh database
 *
 * @returns null|Function null if a callback was specified else a partially
 *          applied version of `modify` is returned.
 */
function modify(model, id, where, mutator, callback) {
  if (!callback) {
    return _.partial(modify, model, id, where, mutator);
  }

  // If they pass in a record, get its id
  if (_.isObject(id)) {
    id = id.id;
  }

  model.get(id, function modifyGet_(err, obj) {
    if (err) {
      return callback(err);
    }

    mutator(obj);

    model.save(obj, where, function modifySave_(err, savedObject) {
      // Other errors are passed back in tact
      if (err) {
        return callback(err);
      }

      callback(null, savedObject);
    });
  });
}


/**
 * Find the first row that matchs the properties of the query. If nothing is
 * found with the query, a 404 error is returned.
 *
 * @param model Object The model instance. This parameter is not specified when
 *        using the method through a model instance 
 * @param properties Object The values to match against
 * @param [opts] Object
 * @param [opts.offset] Number Number of rows to skip before returning one
 * @param [opts.order] Function(table Object) Function to allow custom sorting
 *        before returning the first
 * @param [callback] Function(err Error, row Object)
 * 
 * @returns null|Function null if a callback was specified else a partially
 *          applied version of `first` is returned.
 */
function first(model, properties, opts, callback) {
  // Shift around the arguments to allow alternate forms
  if (arguments.length === 2) {
    opts = {};
  } else if (arguments.length === 3 && typeof arguments[2] === 'function') {
    callback = arguments[2];
    opts = {};
  }

  // If there is no callback, return a partially applied function
  if (!callback) {
    return _.partial(first, model, properties, opts);
  }

  opts.limit = 1;

  all(model, properties, opts, function first_(err, objects) {
    if (err) {
      return callback(err);
    }

    callback(null, objects[0]);
  });
}


/**
 * Find all the rows that matchs the properties of the query.
 *
 * @param model Object The model instance. This parameter is not specified when
 *        using the method through a model instance 
 * @param properties Object The values to match against
 * @param [opts] Object
 * @param [opts.limit] Number Maximum number of rows to return
 * @param [opts.offset] Number Number of rows to skip before returning one
 * @param [opts.order] Function(table Object) Function to allow custom sorting
 *        before returning the first
 * @param [callback] Function(err Error, rows Array)
 * 
 * @returns null|Function null if a callback was specified else a partially
 *          applied version of `first` is returned.
 */
function all(model, properties, opts, callback) {
  // Shift around the arguments to allow alternate forms
  if (arguments.length === 2) {
    opts = {};
  } else if (arguments.length === 3 && typeof arguments[2] === 'function') {
    callback = arguments[2];
    opts = {};
  }

  // If there is no callback, return a partially applied function
  if (!callback) {
    return _.partial(all, model, properties, opts);
  }

  var t = model.table;
  var sql = selectClause(model, t, opts.select);
  sql = whereClause(model, sql, properties);
  sql = orderClause(model, sql, opts.order);

  // Depending on the options supplied we need to add additional modifiers
  if (opts.limit) {
    sql.limit(opts.limit);
  }

  if (opts.offset) {
    sql.offset(opts.offset);
  }

  if (model.logQueries) {
    var startTime = Date.now();
  }

  var query = sql.toQuery();

  model.client.query(query.text, query.values, function all_(err, result) {
    if (model.logQueries) {
      console.log('[%dms] %s', Date.now() - startTime, sql.toString());
    }

    if (err) {
      return callback(err);
    }

    if (!opts.include) {
      async.map(result.rows, model.build, callback);
    } else {
      async.map(result.rows, model.build, function (err, records) {
        if (err) {
          return callback(err);
        }

        model.include(records, opts.include, function (err) {
          if (err) {
            return callback(err);
          }

          return callback(null, records);
        });
      });
    }
  });
}


/**
 * Given a set of records, load the given relationships into them. This mutates
 * the records passed in.
 *
 *  var User = sqlbox.create({
 *    name: 'user',
 *    columns: [
 *      {name: 'email'}
 *    ],
 *    relations: [
 *      {type: 'hasMany', name: 'posts', model: 'post'}
 *    ]
 *  });
 *
 *  var Comment = sqlbox.create({
 *    name: 'comment',
 *    columns: [
 *      {name: 'body'},
 *      {name: 'userId'}
 *    ],
 *    relations: [
 *      {type: 'belongsTo', name: 'user', model: 'user'}
 *    ]
 *  });
 *
 *  User.all({}, function (err, users) {
 *    User.include(users, 'posts', function () { ... });
 *    User.include(users, ['posts', 'comments'], function () { ... });
 *  });
 *
 * @param model Object
 * @param records Object|Array
 * @param inc String|Array|Object
 * @param callback Function(err Error)
 */
function include(model, records, inc, callback) {
  records = _.isArray(records) ? records : [records];

  if (records.length === 0) {
    return callback();
  }

  if (_.isArray(inc)) {
    return async.each(inc, _.partial(include, model, records), callback);
  }

  if (_.isObject(inc)) {
    var fns = _.map(inc, function (v, k) {
      return function (callback) {
        include(model, records, k, function (err, associatedRecords) {
          if (err) {
            return callback(err);
          }

          var associatedModel = helpers.modelForRelation(model, k);
          include(associatedModel, associatedRecords, v, callback);
        });
      }
    });

    return async.parallel(fns, callback);
  }

  if (_.isString(inc)) {
    var associatedModel = helpers.modelForRelation(model, inc);
    var relation = helpers.relationByName(model, inc);
    var foreignKey = helpers.foreignKeyForRelation(model, inc);
    var query = {};
    var options = relation.options || {};

    if (relation.type === 'belongsTo') {
      query.id = {in: _.pluck(records, foreignKey)};
    }
    else if (relation.type === 'hasMany' || relation.type === 'hasOne') {
      query[foreignKey] = {in: _.pluck(records, 'id')};
    }
    
    associatedModel.all(query, options, function (err, associatedRecords) {
      if (err) {
        return callback(err);
      }

      if (relation.type === 'belongsTo') {
        _.each(records, function (r) {
          r[inc] = _.findWhere(associatedRecords, {id: r[foreignKey]});
        });
      }
      else if (relation.type === 'hasMany' || relation.type === 'hasOne') {
        var grouped = _.groupBy(associatedRecords, foreignKey);

        _.each(records, function (r) {
          var associated = grouped[r.id] || [];

          if (relation.type === 'hasOne') {
            associated = _.first(associated);
          }

          r[inc] = associated;
        });
      }

      callback(null, associatedRecords);
    });
  } else {
    var msg = 'Type not supported in include statement: ' + JSON.stringify(inc);
    callback(new BoxError(500, msg));
  }
}


function query(model, queryFn, callback) {
  var t = model.table;
  var sql = queryFn(t);

  if (model.logQueries) {
    var startTime = Date.now();
  }

  var sqlQuery = sql.toQuery();
  var sqlText = sqlQuery.text;
  var sqlValues = sqlQuery.values;

  model.client.query(sqlText, sqlValues, function query_(err, result) {
    if (model.logQueries) {
      console.log('[%dms] %s', Date.now() - startTime, sql.toString());
    }

    if (err) {
      return callback(err);
    }

    async.map(result.rows, model.build, function (err, results) {
      if (err) {
        return callback (err);
      }

      return callback(null, results);
    });
  });
}

function hasChanges(model, obj) {
  if ('$meta' in obj === false) {
    return true;
  }

  return _.some(model.columns, function (column) {
    return !_.isEqual(obj[column.name], obj.$meta.original[column.name]);
  });
}

/**
 * Sets the SQL dialect for all models.
 *
 * @param name String The name of the SQL dialect.
 * @returns null
 */
function setDialect(name) {
  dialect = require('./dialects/' + name);
}

// ----------------------------------------------------------------------------
// Private Functions
// ----------------------------------------------------------------------------

/**
 * Inserts a new row into the database.
 *
 * @param model Object The model instance used to get table information
 * @param obj Object The row to insert into the database
 * @param callback Function(err Error, insertedRow Object)
 */
function saveNew(model, obj, callback) {
  obj = columnsToSource(model, obj);

  var t = model.table;

  // INSERT INTO table (...) VALUES (...);
  var query = dialect.getSaveQuery(model, obj);

  if (model.logQueries) {
    var startTime = Date.now();
  }

  model.client.query(query.text, query.values, function saveNew_(err, result) {
    if (model.logQueries) {
      console.log('[%dms] %s', Date.now() - startTime, query.sql);
    }

    if (err) {
      return callback(err);
    }

    if (dialect.getSavedRowCount(result)) {
      build(model, dialect.getSavedRecord(result), function (err, record) {
        if (err) {
          return callback(err);
        }

        runHooks(model, record, ['afterCreate', 'afterSave'], callback);
      });
    } else {
      var msg = dialect.name + ' returned no error, but no row was returned.';
      callback(new BoxError(500, msg));
    }
  });
}


/**
 * Updates a row in the database.
 *
 * A where clause can be passed in to ensure that if concurrent updates are
 * happening that the record is still as expected before applying the update.
 * If the where clause does not match, a 409 is returned.
 *
 * @param model Object The model instance used to get the table information
 * @param obj Object The updated row data
 * @param where Object The where clause the update must match
 * @param callback Function(err Error, updatedRow Object)
 */
function saveUpdate(model, obj, where, callback) {
  where = where || {}
  where.id = obj.id;

  // Clear out date fields that sqlbox manages
  delete obj.id;
  delete obj.createdAt;
  delete obj.updatedAt;

  var changeSet;

  if (obj.$meta && obj.$meta.original) {
    changeSet = changes(obj, obj.$meta.original);
  } else {
    changeSet = obj;
  }

  var sourceObject = columnsToSource(model, changeSet);

  var query = dialect.getUpdateQuery(model, where, whereClause, sourceObject);
  
  if (model.logQueries) {
    var startTime = Date.now();
  }

  model.client.query(query.text, query.values, function saveUpdate_(err, result) {
    if (model.logQueries) {
      console.log('[%dms] %s', Date.now() - startTime, query.text);
    }

    if (err) {
      return callback(err);
    }

    if (dialect.getSavedRowCount(result)) {
      build(model, dialect.getSavedRecord(result), function (err, record) {
        if (err) {
          return callback(err);
        }

        runHooks(model, record, ['afterUpdate', 'afterSave'], callback);
      });
    } else {
      var msg =
        ('Row with id ' + where.id + ' was not found in ' + model.name + ', ' +
         'or the where clause did not pass.');
      callback(new BoxError(409, msg));
    }
  });
}

/**
 * Creates a new object that replaces the name keys of obj with the source keys
 * defined in the model.columns spec. This is used to convert the runtime data
 * with friendly names to the actual database column names.
 *
 * @param model Object The model instance that defines the column spec
 * @param obj Object The table row data with database column names
 * @returns Object The data with keys replaced by their database source
 *          column names
 */
function columnsToSource(model, obj) {
  var newObject = {};

  _.each(model.columns, function (column) {
    if (column.name in obj) {
      newObject[column.source] = obj[column.name];
    }
  });

  return newObject;
}

/**
 * Runs the validations on an object.
 *
 * @param model Object The model instance that defines the validations
 * @param obj Object The object to validate against the model
 * @param callback Function(error Error, bool isValid) If isValid is
 *        false, error will exist, else it will be null. The error contains
 *        .validationErrors which is an array of various issues found.
 */
function validate(model, obj, callback) {
  var v = new Validator();
  var errors = [];

  v.error = function (msg) {
    if (v.currentKey) {
      var error = _.findWhere(errors, {key: v.currentKey});

      if (error) {
        error.failed.push(v.currentKeyValidation);
      } else {
        errors.push({
          key: v.currentKey,
          value: v.currentValue,
          expected: v.currentKeyValidations,
          failed: [v.currentKeyValidation]
        });
      }
    } else {
      errors.push({message: msg});
    }
  };

  _.each(model.validations, function (validations, key) {
    var value = obj[key];
    v.currentKey = key;
    v.currentValue = value;
    v.currentKeyValidations = validations;

    // Validation form: ['exists', ['len', 1, 10], customFn]
    _.each(validations, function (validation) {
      v.currentKeyValidation = validation;

      if (_.isString(validation)) {
        // Form: 'exists'
        v.check(value)[validation]();
      } else if (_.isArray(validation)) {
        // Form: ['len', 1, 10]
        var check = v.check(value);
        check[validation[0]].apply(check, validation.slice(1));
      } else if (_.isFunction(validation)) {
        // Form: function (obj, key, v) {}
        validation(obj, key, v);
      }
    });
  });

  delete v.currentKey;
  delete v.currentValue;
  delete v.currentKeyValidations;
  delete v.currentKeyValidation;

  model.validate(obj, v);

  if (errors.length) {
    var err = new BoxError(403, 'Validation did not pass.');
    err.validationErrors = errors;
    callback(err, false);
  } else {
    callback(null, true);
  }
}

/**
 * Runs a single hook that is defined on a model. Threads obj through each
 * of the hooks functions in sequence.
 *
 * @param model Object The model
 * @param obj Object The record triggering the hook
 * @param hookName String The name of the hook to perform
 * @param callback Function(err Error)
 */
function runHook(model, obj, hookName, callback) {
  var hook = model.hooks[hookName];

  if (_.isFunction(hook)) {
    hook(obj, function (err) {
      return err ? callback(err) : callback(null, obj);
    });
  } else if (_.isArray(hook)) {
    var fns = _.map(_.filter(hook, _.isFunction), function (fn) {
      return _.partial(fn, obj);
    });

    async.series(fns, function (err) {
      return err ? callback(err) : callback(null, obj);
    });
  } else {
    // No hook
    callback(null, obj);
  }
}

/**
 * Runs the given hooks that are defined on a model. Threads obj through each
 * hook in sequence.
 *
 * @param model Object The model
 * @param obj Object The record triggering the hooks
 * @param hookNames Array An array of the names of the hooks to perform
 * @param callback Function(err Error)
 */
function runHooks(model, obj, hookNames, callback) {
  var fns = _.map(hookNames, function (hookName) {
    return _.partial(runHook, model, obj, hookName);
  });

  async.series(fns, function (err) {
    return err ? callback(err) : callback(null, obj);
  });
}

/**
 * Determines the differences between 2 objects. The value that is returned
 * in the diff object is always from the first object.
 *
 * @param o1 Object The first object to compare
 * @param o2 Object The secont object to compare
 * @returns Object The differences
 */
function changes(o1, o2) {
  var changeSet = {};

  _.each(o1, function (value, key) {
    var value2 = o2[key];

    if (!_.isEqual(value, value2)) {
      changeSet[key] = value;
    }
  });

  return changeSet;
}

/**
 * Clones an object. For the most part this is a shallow clone, except it will
 * clone depth 1 arrays as well (shallow cloning them).
 *
 * @param obj Object The object to clone
 * @returns Object The clone
 */
function cloneObject(obj) {
  var clonedObj = {};

  _.each(obj, function (value, key) {
    if (_.isArray(value)) {
      clonedObj[key] = value.slice(0);
    } else {
      clonedObj[key] = value;
    }
  });

  return clonedObj;
}

/**
 * Creates a new copy of an object that removes all non columns as defined in
 * the model.
 *
 * @param model Object The model
 * @param obj Object The object to prune
 * @returns Object The newly created pruned object
 */
function pruneToColumns(model, obj) {
  var instance = {};

  _.each(model.columns, function (column) {
    var value;

    if (column.name in obj) {
      value = obj[column.name];
    } else if (column.source in obj) {
      value = obj[column.source];
    } else {
      // Column defined in the model could not be found in the databse row, so
      // we skip to the next column.
      return;
    }

    if (_.isArray(value)) {
      instance[column.name] = value.slice(0);
    } else {
      instance[column.name] = value;
    }
  });

  return instance;
}

/**
 * Creates the where clause on a node-sql query based on the where spec passed
 * in.
 *
 * @param model Object The model to query againts
 * @param query Object The current sql-box query to mutate
 * @param whereProperties Object The conditions to add to the query
 * @returns Object The mutated query (for chaining)
 */
function whereClause(model, query, whereProperties) {
  var t = model.table;

  // Iterate through the provided properties and build out the WHERE clause
  _.each(whereProperties, function (value, columnName) {
    var columnSpec = _.findWhere(model.columns, {name: columnName});

    if (!columnSpec) {
      return;
    }

    if (_.isObject(value)) {
      _.each(value, function (innerValue, operator) {
        // Rename short form operators to their node-sql counterparts
        if (operator === 'not') {
          operator = 'notEquals';
        }
        else if (operator === 'eq' || operator === 'is' || operator === 'eql') {
          operator = 'equals';
        }

        // We need to do a dance to get NULL to work as expected
        if (innerValue === null) {
          operator = operator === 'notEquals' ? 'isNotNull' : 'isNull';
          innerValue = undefined;
        }

        query.where(t[columnSpec.source][operator](innerValue));
      });
    } else {
      query.where(t[columnSpec.source].equals(value));
    }
  });

  return query;
}

function selectClause(model, query, columns) {
  var t = model.table;

  // If columns is not specified, select table.*
  if (!columns) {
    // columns = _.pluck(model.columns, 'name');
    return query.select(t.star());
  }

  var success = false;

  _.each(columns, function (name) {
    var source = columnSource(model, name);

    assert(source, 'Select clause failed to select `' + name +
      '` from table `' + model.tableName + '`. ' +
      'Reason: Column is not defined on model.');

    success = true;
    query = query.select(t[source]);
  });

  return query;
}

function orderClause(model, query, order) {
  if (!order) {
    return query;
  }

  var ordering = _.map(order, function (v, k) {
    return model.table[columnSource(model, k)][v];
  });

  query.order(ordering);

  return query;
}

function columnByName(model, columnName) {
  return _.findWhere(model.columns, {name: columnName});
}

function columnSource(model, columnName) {
  var column = columnByName(model, columnName);
  return column ? column.source : undefined;
}

// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

exports.build = build;
exports.get = get;
exports.mget = mget;
exports.save = save;
exports.remove = remove;
exports.modify = modify;
exports.first = first;
exports.all = all;
exports.include = include;
exports.query = query;
exports.hasChanges = hasChanges;
exports.setDialect = setDialect;
