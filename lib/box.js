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
**/


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
  var query = t.select(t.star()).where(t.id.equals(Number(id)));

  box.client.query(query.toQuery(), function (err, result) {
    if (err) {
      return callback(err);
    }

    if (result.rows.length) {
      return callback(null, columnsFromSource(box, result.rows[0]));
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
  var query = t.select(t.star()).where(t.id.in(_.map(ids, Number)));

  box.client.query(query.toQuery(), function (err, result) {
    if (err) {
      return callback(err);
    }

    return callback(null, _.map(result.rows, _.partial(columnsFromSource, box)));
  });
}


function save(box, obj, callback) {
  if (!callback) {
    return _.partial(save, box, obj);
  }

  if (obj.id) {
    saveUpdate(box, obj, callback);
  } else {
    saveNew(box, obj, callback);
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
  var query = t.insert(obj).returning(t.star()).toQuery();

  box.client.query(query, function (err, result) {
    if (err) {
      return callback(err);
    }

    if (result.rows.length) {
      callback(null, columnsFromSource(box, result.rows[0]));
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
      callback(null, columnsFromSource(box, result.rows[0]));
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
    if (obj[column.source]) {
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
    if (obj[column.name]) {
      newObject[column.source] = obj[column.name];
    }
  });

  return newObject;
}


// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

exports.get = get;
exports.mget = mget;
exports.save = save;
