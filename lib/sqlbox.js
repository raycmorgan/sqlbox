// ----------------------------------------------------------------------------
// Requirements
// ----------------------------------------------------------------------------

var _ = require('underscore')
  , pg = require('pg')
  , sql = require('sql')
  , box = require('./box');

var clients = {};


// ----------------------------------------------------------------------------
// Public Functions
// ----------------------------------------------------------------------------

/**
 * Creates a database client and stores it by the given name (or default).
 *
 * @param [name] String The name to store the client as, this can be used in
 *        sqlbox.create to allow different models to use different connections.
 *        Defaults to 'default'
 * @param fn Function(pg Object) The object returned from require('pg'). Use
 *        this to create the client. This function should return the client
 *        once it is created.
 */
function createClient(name, fn) {
  if (arguments.length === 1 && typeof arguments[0] === 'function') {
    fn = arguments[0];
    name = 'default';
  }

  var db = fn(pg);

  if (db) {
    db.connect(function (err) {
      if (err) {
        console.log(err);
      }
    });

    clients[name] = db;
  }
}


/**
 * Closes and removes a known client by its name.
 *
 * @param [name] String The name of the client to close and remove. Defaults
 *        to 'default'
 */
function removeClient(name) {
  name = name || 'default';

  if (clients[name]) {
    clients[name].end();
    delete clients[name];
  }
}

/**
 * Create a new sqlbox model. An model contains all the functions for
 * accessing and modifying the data of a single SQL table.
 *
 * The only property that is required is the tableName, but that would make
 * for a pretty boring sqlbox model. Usually extra columns and indexes are
 * defined to help query the database easily.
 *
 * SQLBox does not do joins. IMHO joins are good for things like reporting, but
 * less so for applications. Instead, you can create relations that will make
 * additional queries for related data. It is a simple and scalable solution.
 * It gets around the n+1 query situation by fetching the relations of a
 * collection of items in batch.
 *
 * You can always do custom joins yourself using the node-sql interface bound
 * to the model.table. This is probably better since joins can be complex
 * and performance can become an issue, so automating it probably sucks.
 *
 * @param opts Object
 * @param opts.tableName String The name of the table that this model
 *        will interact with
 * @param opts.columns Array A list of columns and their types
 * @param opts.revisionColumnName String Defaults to 'revision'. The column
 *        used to determine the revision of the row. Used to avoid concurrent
 *        update conflicts
 * @param opts.validate Function(obj Object, v Object) Handles validating an
 *        instance before saving. The function is passed the object being saved
 *        and a node-validator Validator instance.
 * @param opts.clientName String The name of the database client created with
 *        sqlbox.createClient. Defaults to 'default'
 *
 * @returns Object The sqlbox model for interating with `opts.tableName`
 */
function create(opts) {
  var model = _.defaults(opts || {}, {
    tableName: null,
    columns: [],
    revisionColumnName: 'revision'
  });

  // Make sure a table name was specified
  if (!model.tableName) {
    throw new Error('sqlbox.create must be supplied a tableName property');
  }

  model.client = clients[opts.clientName || 'default'];

  // Add implicit columns and standardize them
  model.columns = appendIdentifierColumn(model.columns);
  model.columns = appendTimestampColumns(model.columns);
  model.columns = appendRevisionColumn(model.columns, model.revisionColumnName);
  model.columns = standardizeColumns(model.columns);

  // Define the table to query against
  model.table = defineTable(model.tableName, model.columns);

  // Add box methods to the box instance
  model.build = _.partial(box.build, model);
  model.get = _.partial(box.get, model);
  model.mget = _.partial(box.mget, model);
  model.save = _.partial(box.save, model);
  model.remove = _.partial(box.remove, model);
  model.modify = _.partial(box.modify, model);
  model.first = _.partial(box.first, model);
  model.all = _.partial(box.all, model);
  model.query = _.partial(box.query, model);

  return model;
}


// ----------------------------------------------------------------------------
// Private Functions
// ----------------------------------------------------------------------------

/**
 * Creates a new array with the id column added to the original array.
 *
 * @param columns Array The array of defined columns
 * @returns Array A copy of the original array with the id column added
 */
function appendIdentifierColumn(columns) {
  return columns.concat([
    {name: 'id', type: 'integer'}
  ]);
}

/**
 * Creates a new array with the createdAt and updatedAt columns add to the
 * original array.
 *
 * @param columns Array The array of defined columns
 * @returns Array A copy of the original array with the new columns added
 */
function appendTimestampColumns(columns) {
  return columns.concat([
    {name: 'createdAt', type: 'date'},
    {name: 'updatedAt', type: 'date'}
  ]);
}


/**
 * Creates a new array with the revision column added.
 *
 * @param columns Array The array of defined columns
 * @param revisionColumnName String The name of the revision column
 * @returns Array A copy of the original array with the new column added
 */
function appendRevisionColumn(columns, revisionColumnName) {
  return columns.concat([
    {name: revisionColumnName, type: 'integer'}
  ]);
}


/**
 * Creates a new columns array with all the implied properties filled in.
 *
 * @param columns Array The array of defined columns
 * @returns Array A copy of the original array with all defaults filled in
 */
function standardizeColumns(columns) {
  return _.map(columns, function (column) {
    var c = _.clone(column);

    if (!c.source) {
      c.source = toUnderscore(c.name);
    }

    return c;
  });
}


/**
 * Returns a underscored version of a camelcase/hyphenated string.
 *
 * @param str String The string to convert
 * @returns String The string in underscore format
 */
function toUnderscore(str) {
  return str.replace(/([A-Z-])/g, function (res, match, offset) {
    if (offset === 0) {
      return match.toLowerCase();
    } else {
      return match == '-' ? '_' : ('_' + match.toLowerCase());
    }
  });
}


/**
 * Defines a node-sql table given a tableName and sqlbox style columns. This
 * node-sql table is used internally to create query statements.
 *
 * @param tableName String The name of the table to define
 * @param columns Array An array of columns
 * @returns Object The node-sql defined table
 */
function defineTable(tableName, columns) {
  return sql.define({
    name: tableName,
    columns: _.map(columns, function (column) {
      return column.source;
    })
  });
}


// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

exports.clients = clients;
exports.createClient = createClient;
exports.removeClient = removeClient;
exports.create = create;

// Export private functions if we are testing
if (process.env.SQLBOX_ENV === 'TEST') {
  exports.appendIdentifierColumn = appendIdentifierColumn;
  exports.appendTimestampColumns = appendTimestampColumns;
  exports.appendRevisionColumn = appendRevisionColumn;
  exports.standardizeColumns = standardizeColumns;
  exports.toUnderscore = toUnderscore;
  exports.defineTable = defineTable;
}
