'use strict';

// ----------------------------------------------------------------------------
// Requirements
// ----------------------------------------------------------------------------

var _ = require('underscore');

exports.name = 'MySQL';

// ----------------------------------------------------------------------------
// Public Functions
// ----------------------------------------------------------------------------

/**
 * Creates a save query object for a box.
 *
 * @param box Object The model that defines the column spec
 * @param obj Object The data to transform
 * @returns Object The query object.
 */
exports.getSaveQuery = function (box, obj) {
  var t = box.table
    , sql = t.insert(obj)
    , query = sql.toQuery();

  query.text = query.text.replace('`)', '`,`created_at`,`updated_at`)');
  query.text = query.text.replace('?)', '?, NOW(), NOW())');

  // MySQL doesn't support a RETURNING clause, so we must do a second query for
  // the row we just inserted.
  query.text += '; SELECT * FROM `' + t._name + '` WHERE `id` = LAST_INSERT_ID();';

  return _.extend(query, { sql: sql.toString() });
};

/**
 * Creates a get query object for a box.
 *
 * @param box Object The model that defines the column spec
 * @param obj Object The data to transform
 * @returns Object The query object.
 */
exports.getUpdateQuery = function (box, where, whereClause, obj) {
  var t = box.table;

  // UPDATE table SET (...)
  //   WHERE table.id = $id AND ...
  //   RETURNING table.*;
  var sql = t.update(obj);
  sql = whereClause(box, sql, where);

  var query = sql.toQuery();

  // node-sql does not support functions like now() so we have
  // to hack it in there with string manipulation for now. Will work something
  // into node-sql time permitting.
  if (_.size(obj) === 0) {
    query.text = query.text.replace(' WHERE', '`updated_at` = NOW() WHERE');
  } else {
    query.text = query.text.replace(' WHERE', ', `updated_at` = NOW() WHERE');
  }

  // MySQL doesn't support a RETURNING clause, so we must do a second query for
  // the row we just inserted.
  query.text += '; SELECT * FROM `' + t._name + '` WHERE `id` = LAST_INSERT_ID();'

  return query;
};

/**
 * Gets the number of rows saved.
 *
 * @param result Object The result returned by the SQL client.
 * @returns Number The number of saved rows.
 */
exports.getSavedRowCount = function (result) {
  return (result.rows && result.rows[0].affectedRows && result.rows[1]) ? 
    result.rows[1].length : 0;
};

/**
 * Gets the number of rows removed.
 *
 * @param result Object The result returned by the SQL client.
 * @returns Number The number of removed rows.
 */
exports.getRemovedRowCount = function (result) {
  return result.rows.affectedRows;
};

/**
 * Gets the saved record.
 *
 * @param result Object The result returned by the SQL client.
 * @returns Object The row saved to the database.
 */
exports.getSavedRecord = function (result) {
  return result.rows[1][0];
};

/**
 * Determines if an error is a duplicate entry error from a UNIQUE constraint
 * on a column.
 *
 * @param err Error The error returned by the SQL client.
 * @returns Boolean Whether or not the error is a duplicate entry error.
 */
exports.isDupEntryError = function (err) {
  return err.code == 'ER_DUP_ENTRY';
};

/**
 * Parses out the key and value from a duplicate entry error.
 *
 * @param err Error The error returned by the SQL client.
 * @returns Array The [key, value] that violated the UNIQUE constraint.
 */
exports.parseDupEntryError = function (err) {
  var parsed = err.toString().match(/\'(.*)\' for key \'(.*)\'/);
  return [parsed[2], parsed[1]];
};