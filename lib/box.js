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

  box.database.query(query.toQuery(), function (err, result) {
    if (err) {
      return callback(err);
    }

    if (result.rows.length) {
      return callback(null, result.rows[0]);
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

  box.database.query(query.toQuery(), function (err, result) {
    if (err) {
      return callback(err);
    }

    return callback(null, result.rows);
  });
}


// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

exports.get = get;
exports.mget = mget;
