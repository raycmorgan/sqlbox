// ----------------------------------------------------------------------------
// Requirements
// ----------------------------------------------------------------------------

var _ = require('underscore');


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

  You can also interact directly with these methods:

    // This is the same as above
    box.get(People, 1, function (err, person) {
      // ...
    });
**/


/**
 * Builds a obj that conforms to the column spec defined in the model. Removes
 * all excess properties.
 *
 * @param box Object The model that defines the column spec
 * @param obj Object The data to transform
 * @returns Object The transformed object that comforms to the column spec
 */
function build(box, obj) {
  var instance = {};

  _.each(box.columns, function (column) {
    if (column.name in obj) {
      instance[column.name] = obj[column.name];
    } else if (column.source in obj) {
      instance[column.name] = obj[column.source];
    }
  });
  
  // Holding off on the $meta property until sqlbox is at a point where it
  // becomes useful and clearer how it will be used.
  //
  // // Define a non-enumerable $meta property on the instance. This is used
  // // for book keeping and extra properties that should be passed around with
  // // the data.
  // Object.defineProperty(instance, '$meta', {
  //   value: {},
  //   enumerable: false
  // });
  //
  // // Save a clone of the data in its meta. This allows comparing changed objects
  // // to what they originally where.
  // instance.$meta.original = _.clone(instance);
  
  return instance;
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
 * @param box Object The model instance. This parameter is not specified when
 *        using the method through a model instance
 * @param id Number The id of the row to fetch
 * @param [opts] Object
 * @param [callback] Function(err Error, row Object)
 * 
 * @returns null|Function null if a callback was specified else a partially
 *          applied version of `get` is returned.
 */
function get(box, id, opts, callback) {
  // Shift around the arguments to allow alternate forms
  if (arguments.length === 2) {
    opts = {};
  } else if (arguments.length === 3 && typeof arguments[2] === 'function') {
    callback = arguments[2];
    opts = {};
  }

  // If there is no callback, return a partially applied function
  if (!callback) {
    return _.partial(get, box, id, opts);
  }

  // Check to make sure we don't actually just have the object already, this
  // helps in code reuse where you might have the object or id.
  if (typeof id === 'object') {
    return id;
  }

  var t = box.table;

  // SELECT table.* FROM table WHERE table.id = $id;
  var query = t.select(t.star()).where(t.id.equals(Number(id)));

  box.client.query(query.toQuery(), function (err, result) {
    if (err) {
      return callback(err);
    }

    if (result.rows.length) {
      return callback(null, build(box, result.rows[0]));
    } else {
      return callback(new Error(404));
    }
  });
}


/**
 * Get multiple rows from a table by their ids. Uses the sql IN operator. Like
 * `get`, this also returns a partially applied function of itself if the
 * callback is not specified.
 *
 * @param box Object The model instance. This parameter is not specified when
 *        using the method through a model instance
 * @param ids Array The ids of the rows to fetch
 * @param [opts] Object
 * @param [callback] Function(err Error, rows Array)
 * 
 * @returns null|Function null if a callback was specified else a partially
 *          applied version of `get` is returned.
 */
function mget(box, ids, opts, callback) {
  // Shift around the arguments to allow alternate forms
  if (arguments.length === 2) {
    opts = {};
  } else if (arguments.length === 3 && typeof arguments[2] === 'function') {
    callback = arguments[2];
    opts = {};
  }

  // If there is no callback, return a partially applied function
  if (!callback) {
    return _.partial(mget, box, id, opts);
  }

  var t = box.table;

  // SELECT table.* FROM table WHERE table.id IN ($ids[0], $ids[1], ...);
  var query = t.select(t.star()).where(t.id.in(_.map(ids, Number)));

  box.client.query(query.toQuery(), function (err, result) {
    if (err) {
      return callback(err);
    }

    return callback(null, _.map(result.rows, box.build));
  });
}


/**
 * Saves a new or updated row into the database based on the box information.
 * Like `get`, this also returns a partially applied function of itself if the
 * callback is not specified.
 *
 * @param box Object The model instance. This parameter is not specified when
 *        using the method through a model instance 
 * @param obj Object The data to save or update to the database
 * @param [callback] Function(err Error, savedRow Object)
 *
 * @returns null|Function null if a callback was specified else a partially
 *          applied version of `save` is returned.
 */
function save(box, obj, callback) {
  if (!callback) {
    return _.partial(save, box, obj);
  }

  // If the obj has an id, we assume it is not new, this might be a good
  // place to utilize $meta.
  if (obj.id) {
    saveUpdate(box, obj, callback);
  } else {
    saveNew(box, obj, callback);
  }
}


/**
 * Remove a row from the database.
 *
 * @param box Object The model instance. This parameter is not specified when
 *        using the method through a model instance 
 * @param id Number The id of the row to remove
 * @param [callback] Function(err Error, success Boolean)
 *
 * @returns null|Function null if a callback was specified else a partially
 *          applied version of `remove` is returned.
 */
function remove(box, id, callback) {
  if (!callback) {
    return _.partial(remove, box, id);
  }

  var t = box.table;

  // DELETE FROM table WHERE table.id = $id;
  var query = t.delete().where(
        t.id.equals(Number(id))
      ).toQuery();

  box.client.query(query, function (err, result) {
    if (err) {
      return callback(err);
    }

    if (result.rowCount) {
      callback(null, true);
    } else {
      callback(new Error(404));
    }
  });
}


/**
 * Modify is a higher level function that helps with the get/save loop. It
 * manages retrying saves if another actor updates the row being modified,
 * handles rules around what a valid object to update looks like (ensures),
 * and in general is a simpler, less nested way to mutate a row.
 *
 * @param box Object The model instance. This parameter is not specified when
 *        using the method through a model instance 
 * @param id Number The id of the row to modify
 * @param opts Object
 * @param opts.maxRetries Number The maximum number of get/save cycles that
 *        should be tried in case of row contention. Default: 3
 * @param opts.ensures Array An array of predicates that the database object
 *        must match in order to progress through the save cycle. If one ensure
 *        fails, a 409 error is returned via the callback.
 * @param mutator Function(obj Object) A function that takes the fetched
 *        database row and is responsible for changing it. This function
 *        may be ran multiple times on save conflicts, so should not have any
 *        side effects.
 * @param callback Function(err Error, obj Object) The function that will be
 *        called after a successful update or after too many retries. The obj
 *        will reflect the new row in teh database.
 *
 * @returns null|Function null if a callback was specified else a partially
 *          applied version of `modify` is returned.
 */
function modify(box, id, opts, mutator, callback) {
  if (!callback) {
    return _.partial(modify, box, id, opts, mutator);
  }

  trySave(1);

  // Inner function used to perform a get/mutate/save cycle. Will be called
  // multiple times on save conflicts.
  function trySave(tryNumber) {
    // Check to see if we are above the maxRetries
    if (tryNumber > (opts.maxRetries || 3)) {
      return callback(new Error('503'));
    }

    // Fetch the object from the database
    box.get(id, opts, function (err, obj) {
      if (err) {
        return callback(err);
      }

      // Make sure the object passes the ensure predicates
      var ensuresPass = _.every(opts.ensures, function (ensureFn) {
        return ensureFn(obj);
      });

      if (!ensuresPass) {
        return callback(new Error('409'));
      }

      // Mutate the object
      mutator(obj);

      // Attempt to save the mutated object
      box.save(obj, function (err, savedObject) {
        // If there was a conflict, try the cycle again
        if (err && err.message === '409') {
          return trySave(tryNumber + 1);
        }

        // Other errors are passed back in tact
        if (err) {
          return callback(err);
        }

        callback(null, savedObject);
      });
    });
  }
}


// ----------------------------------------------------------------------------
// Private Functions
// ----------------------------------------------------------------------------

/**
 * Inserts a new row into the database.
 *
 * @param box Object The model instance used to get table information
 * @param obj Object The row to insert into the database
 * @param callback Function(err Error, insertedRow Object)
 */
function saveNew(box, obj, callback) {
  obj = columnsToSource(box, obj);

  var t = box.table;

  // INSERT INTO table (...) VALUES (...);
  var query = t.insert(obj).returning(t.star()).toQuery();

  box.client.query(query, function (err, result) {
    if (err) {
      return callback(err);
    }

    if (result.rows.length) {
      callback(null, build(box, result.rows[0]));
    } else {
      callback(new Error(500));
    }
  });
}


/**
 * Updates a row in the database. The revision column is used as a check to make
 * sure concurrent updates do not take place. The revision of the object must
 * match the current revision in the database.
 *
 * If the revision does not match, an Error with the code 409 (conflict) is
 * returned in the err param of the callback.
 *
 * @param box Object The model instance used to get the table information
 * @param obj Object The updated row data
 * @param callback Function(err Error, updatedRow Object)
 */
function saveUpdate(box, obj, callback) {
  obj = _.clone(obj);

  var id = obj.id
    , currentRevision = obj[box.revisionColumnName];

  // Clear out date fields that sqlbox manages
  delete obj.id;
  delete obj.createdAt;
  delete obj.updatedAt;

  // Increment the revision
  obj[box.revisionColumnName]++;

  var sourceObject = columnsToSource(box, obj);

  var t = box.table;

  // UPDATE table SET (...)
  //   WHERE table.id = $id AND table.revision = $currentRevision
  //   RETURNING table.*;
  var query = t.update(sourceObject).where(
        t.id.equals(id).and(
        t.revision.equals(currentRevision))
      ).returning(t.star()).toQuery();

  // node-sql does not support functions like current_timestamp so we have
  // to hack it in there with string manipulation for now. Will work something
  // into node-sql time permitting.
  query.text = query.text.replace(' WHERE', ', "updated_at" = current_timestamp WHERE');

  box.client.query(query, function (err, result) {
    if (err) {
      return callback(err);
    }

    if (result.rows.length) {
      callback(null, build(box, result.rows[0]));
    } else {
      callback(new Error(409));
    }
  });
}


/**
 * Creates a new object that replaces the source keys of obj with the name keys
 * defined in the box.columns array. This is used to convert actual database
 * column names to the sqlbox instance column names.
 *
 * @param box Object The model instance that defines the column spec
 * @param obj Object The table row data with database column names
 * @returns Object The data with keys replaced by their sqlbox column names
 */
function columnsFromSource(box, obj) {
  var newObject = {};

  _.each(box.columns, function (column) {
    if (column.source in obj) {
      newObject[column.name] = obj[column.source];
    }
  });

  return newObject;
}


/**
 * Creates a new object that replaces the name keys of obj with the source keys
 * defined in the box.columns spec. This is used to convert the runtime data
 * with friendly names to the actual database column names.
 *
 * @param box Object The model instance that defines the column spec
 * @param obj Object The table row data with database column names
 * @returns Object The data with keys replaced by their database source
 *          column names
 */
function columnsToSource(box, obj) {
  var newObject = {};

  _.each(box.columns, function (column) {
    if (column.name in obj) {
      newObject[column.source] = obj[column.name];
    }
  });

  return newObject;
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
