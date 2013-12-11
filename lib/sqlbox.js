'use strict';

// ----------------------------------------------------------------------------
// Requirements
// ----------------------------------------------------------------------------

var _ = require('underscore')
  , assert = require('assert')
  , pg = require('pg')
  , sql = require('sql')
  , pluralize = require('pluralize')
  , methods = require('./sqlbox/model_methods')
  , relations = require('./sqlbox/relations')
  , BoxError = require('./sqlbox/box_error');

var clients = {};
var models = {};


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
    name: null,
    namespace: '',
    columns: [],
    hooks: {},
    validations: {},
    validate: function () {}
  });

  assert(model.name, 'sqlbox.create must be supplied a name property for the model');

  model.tableName = constructTableName(model);

  // We use a getter here so that it doesn't matter when createClient is called
  // compared to sqlbox.create. Also redefining a client will be reflected
  // in all the models that use it.
  Object.defineProperty(model, 'client', {
    enumerable: true,
    get: function () {
      var client = clients[opts.clientName || 'default'];

      assert(client, 'Before using a sqlbox model, you must call ' +
        'sqlbox.createClient.\n  Documentation: ' + 
        'https://github.com/raycmorgan/sqlbox#create-database-client');

      return client;
    }
  });

  // Add implicit columns and standardize them
  model.columns = appendIdentifierColumn(model.columns);
  model.columns = appendTimestampColumns(model.columns);
  model.columns = standardizeColumns(model.columns);

  // Define the table to query against
  Object.defineProperty(model, 'table', {
    value: defineTable(model.tableName, model.columns)
  });

  // Add model methods to the box instance
  _.each(methods, function (fn, name) {
    model[name] = _.partial(fn, model);
  });

  relations.setup(model);

  // Add model to the namespace
  if (model.namespace) {
    models[model.namespace] = models[model.namespace] || {};
    models[model.namespace][model.name] = model;
  } else {
    models[model.name] = model;
  }

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
  return str.replace(/([A-Z-.])/g, function (res, match, offset) {
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


/**
 * Given a model description, this function returns the database table name.
 *
 * @param model Object The model object to determine the table name for
 * @param model.name String The name of the model
 * @param [model.tableName] String The tableName of the model. Note that this
 *        is used verbatim if supplied.
 * @param [model.tablePrefix] String The prefix of the table name
 * @param [model.namespace] String The namespace of the model
 * @returns String The table name
 */
function constructTableName(model) {
  if (model.tableName) {
    return model.tableName;
  } else {
    var tableName = '';

    if (model.namespace) {
      tableName += toUnderscore(model.namespace).toLowerCase() + '_';
    }

    return tableName + pluralize(toUnderscore(model.name)).toLowerCase();
  }
}


// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

exports.clients = clients;
exports.models = models;
exports.createClient = createClient;
exports.removeClient = removeClient;
exports.create = create;
exports.BoxError = BoxError;

// Export private functions if we are testing
if (process.env.SQLBOX_ENV === 'TEST') {
  exports.appendIdentifierColumn = appendIdentifierColumn;
  exports.appendTimestampColumns = appendTimestampColumns;
  exports.standardizeColumns = standardizeColumns;
  exports.toUnderscore = toUnderscore;
  exports.defineTable = defineTable;
  exports.constructTableName = constructTableName;
}
