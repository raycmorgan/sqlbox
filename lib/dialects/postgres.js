'use strict';

// ----------------------------------------------------------------------------
// Requirements
// ----------------------------------------------------------------------------

var _ = require('underscore');

exports.name = 'Postgres';

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
    , obj = _.extend(obj, {'created_at': 'NOW()', 'updated_at': 'NOW()'})
    , sql = t.insert(obj).returning(t.star())
    , query = sql.toQuery();

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

  var query = sql.returning(t.star()).toQuery();

  // node-sql does not support functions like now() so we have
  // to hack it in there with string manipulation for now. Will work something
  // into node-sql time permitting.
  if (_.size(obj) === 0) {
    query.text = query.text.replace(' WHERE', '"updated_at" = now() WHERE');
  } else {
    query.text = query.text.replace(' WHERE', ', "updated_at" = now() WHERE');
  }

  return query;
};

/**
 * Creates a delete query for a box.
 *
 * @param box Object The model that defines the column spec
 * @param id Number The id of the row to remove
 * @returns Object The query object.
 */

exports.getDeleteQuery = function (box, id) {
  var t = box.table;

  var sql = t.delete().where(
        t.id.equals(Number(id))
      ).returning(t.star());

  return sql.toQuery();
};

/**
 * Gets the number of rows saved.
 *
 * @param result Object The result returned by the SQL client.
 * @returns Number The number of saved rows.
 */
exports.getSavedRowCount = function (result) {
  return result.rows.length;
};

/**
 * Gets the number of rows removed.
 *
 * @param result Object The result returned by the SQL client.
 * @returns Number The number of removed rows.
 */
exports.getRemovedRowCount = function (result) {
  return result.rowCount
};

/**
 * Gets the saved record.
 *
 * @param result Object The result returned by the SQL client.
 * @returns Object The row saved to the database.
 */
exports.getSavedRecord = function (result) {
  return result.rows[0];
};

/**
 * Determines if an error is a duplicate entry error from a UNIQUE constraint
 * on a column.
 *
 * @param err Error The error returned by the SQL client.
 * @returns Boolean Whether or not the error is a duplicate entry error.
 */
exports.isDupEntryError = function (err) {
  return err.code == '23505';
};

/**
 * Parses out the key and value from a duplicate entry error.
 *
 * @param err Error The error returned by the SQL client.
 * @returns Array The [key, value] that violated the UNIQUE constraint.
 */
exports.parseDupEntryError = function (err) {
  return err.detail.match(/\(([^)]+)\)=\(([^)]+)\)/);
};
