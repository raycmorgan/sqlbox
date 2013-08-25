[![Build Status](https://travis-ci.org/raycmorgan/sqlbox.png?branch=master)](https://travis-ci.org/raycmorgan/sqlbox)

# Node.js friendly SQL library

SQLBox is not your typical ORM library like Sequelize or Mongoose, etc. It takes a different approach that involves simple function calls and plain (prototype free) objects. No worrying about this — ever.

## Main differences

* No class/instance method distinction, just normal node modules and functions.
* Plays very nicely with Node and the ecosystem. (strict adherence to the standards)
* Consitent declarative syntax where possible over things like chaining.

# State

* Only Postgres is currently supported. Internally uses node-sql to generate queries, so it will be very little work to get MySQL and SQLite working.
* Biggest missing feature is relations. This will be implemented in the near future and documented. For now, a little [async](https://github.com/caolan/async) will go a long way in fetching related data.
* It is stable and safe to use data wise. The APIs might change a bit as features are added/removed/changed.
* Delete is missing, whoops. That will be added shortly.

# Table of contents

* [Usage](#usage)
    * [Setup](#setup)
        * [Installation](#installation)
        * [Create database client](#create-database-client)
    * [Configuring a model](#configuring-a-model)
        * [Custom database table names](#custom-database-table-names)
        * [Alias column names](#alias-column-names)
        * [Validations](#validations)
        * [Hooks](#hooks)
    * [Database interaction](#database-interaction)
        * [Getting rows](#getting-rows)
            * [get](#get)
            * [mget](#mget)
            * [first](#first)
            * [all](#all)
        * [Saving data](#saving-data)
            * [save](#save)
            * [modify](#modify)
        * [Open ended queries](#open-ended-queries)
            * [query](#query)
            * [client](#client)
    * [Complete example](#complete-example)
    * [Errors](#errors)
* [Housekeeping](#housekeeping)

# Usage

## Setup

### Installation

```bash
$ npm install sqlbox
```

### Create database client

Before anything, you must configure the database client.

```javascript
var sqlbox = require('sqlbox');

sqlbox.createClient(function (pg) {
  return new pg.Client('postgres://localhost/database_name');
});
```

As noted above, only Postgres is currently supported. Sorry, others soonish.

## Configuring a model

To use sqlbox, you need to define your table in the database and your model in Node land. When creating the table in your database, you will need to make sure the following columns exist:

* `id` — The primary key, must be set by the database on insert (either serial or some other function)
* `created_at` — Set when row is inserted, must default to `now()`
* `updated_at` — Updated everytime a row is updated. Should default to `now()`

```sql
CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  "name" TEXT,
  "age" INTEGER,
  "email" TEXT,
  "hashed_password" TEXT
);
```

I recommend using something like [db-migrate](https://github.com/nearinfinity/node-db-migrate) to create and maintain schema changes. Once that is created you will need to create the Node.js model. Here is a definition of the previously defined users table:

```javascript
var sqlbox = require('sqlbox');

var User = sqlbox.create({
  name: 'user',

  columns: [
    {name: 'name', type: 'string'},
    {name: 'age', type: 'integer'},
    {name: 'email', type: 'string'},
    {name: 'hashedPassword', type: 'string'}
  ]
});
```

With that you have a fully functional model. The `name` property is the only required field. By default the plural form is used as the database table name. The `columns` property is an array defining the custom columns. Note that you don't have to specify the 4 required columns (id, created_at and updated_at).

### Custom database table names

By default SQLBox uses the lowercase, underscore, plural form of the `name` property as the table name.

```
"user" -> users
"Users" -> users
"person" -> people
"creditCard" -> credit_cards
```

If you have more unique table names the following properties can be used to customize the table name:

* `namespace` – Used to group models. If present, a lowercase, underscore form will be prefixed with the name.
* `tableName` – When all else fails, use this. It is the exact name of the table name to use.

Here are some examples of what is produced:

```
{name: 'user', namespace: 'MyApp'} -> my_app_users
{name: 'user', tableName: 'myApp_member'} -> myApp_member
```

### Alias column names

By default you use camelCase names for columns in sqlbox. These will be translated to their underscored versions when accessing the database. For example, if you have a column in the database named `hashed_password`, you would set the name value of the column in sqlbox to be `hashedPassword`.

You can alias a column name to something completely different by specifing source. Note that source is the exact representation of the database field (underscores, etc).

```javascript
var User = sqlbox.create({
  name: 'user',

  columns: [
    {name: 'location', type: 'string', source: 'zip_code_or_state'}
  ]
});
```

### Validations

There are 2 ways to validate a model before it is saved. The simple form:

```javascript
var User = sqlbox.create({
  name: 'user',

  columns: [
    {name: 'name', type: 'string'},
    {name: 'age', type: 'integer'}
  ],

  validations: {
    name: ['isAlpha'],
    age: ['isInt', ['min', 13], ['max', 100]]
  }
});
```

SQLBox uses [node-validator](https://github.com/chriso/node-validator) internally. Because of this you have access to all of the [validation methods](https://github.com/chriso/node-validator#list-of-validation-methods) described there. Simply convert from the normal form `.len(2, 10)` to the array form `['len', 2, 10]`. This API is pretty much final.

The other more advanced way is to specify `validate` which gets passed the object being validated and a [node-validator](https://github.com/chriso/node-validator) instance to use to validate it.

```javascript
var User = sqlbox.create({
  name: 'user',

  columns: [
    {name: 'name', type: 'string'},
    {name: 'age', type: 'integer'}
  ],

  validate: function (user, v) {
    v.check(user.name).isAlpha();
    v.check(user.age).isInt().min(13).max(100);
  }
});
```

It might look like these two examples are equivalent, but the first will give you an error message with a lot more details on what was expected and what failed. You should always prefer it over the validate method. Use validate when you have very custom logic. Note: Future updates will probably make validate async and require a callback so you can validate against external sources. This API is probably *not* final, be warned.

### Hooks

Hooks let you specify custom logic when certain things have happened. The currently available hooks:

* `beforeValidation`
* `afterValidation`
* `beforeSave` — Called before both creates and updates
* `afterSave` — Called after both creates and updates
* `afterUpdate`
* `afterCreate`

```javascript
var User = sqlbox.create({
  name: 'user',

  columns: [
    {name: 'name', type: 'string'},
    {name: 'hashedPassword', type: 'integer'}
  ],

  hooks: {
    beforeSave: [hashPassword]
  }
});

function hashPassword(user, next) {
  if (user.password) {
    user.hashedPassword = hashingFunction(user.password);
  }
  next();
}
```

You can specify zero, one, or more hooks in the `hooks` object. The values should be either a single function or an array of functions to call one at a time when a hook is triggered. The hook functions must be in the form: `function (obj, callback)` where obj is the object triggering the hook. The second argument `callback` is a function that must be invoked and takes one optional argument `err` you can pass in if something went wrong.

#### Save hooks

When saving an object, the following hooks will be called in this order: `beforeValidation`, `afterValidation`, `beforeSave`, `afterUpdate` (or) `afterCreate`, `afterSave`. If validation passes then only `beforeValidation` will be called. If there are no changes to the record, only `beforeValidation` and `afterValidation` will be called.

All hooks and the actual save are by default contained in a SQL transaction. This allows you to do things like save related models in safety knowing that if anything goes wrong the database will be in a consitent state. Sometimes you don't want this behavior (reaching out to a lot of external services or something), to disable the tansaction pass the option `transaction: false`. (this actually doesn't work yet, soon)


## Database interaction

### Getting rows

#### get

Get a single row by id. If it is not found an error with code 404 will be passed back.

```javascript
User.get(1, function (err, user) {
  // ...
});
```

#### mget

Get multiple rows by ids. Missing ids just won't return anything. If no ids exist, an empty array is passed back.

```javascript
User.mget([1, 2, 3], function (err, users) {
  // ...
});
```

#### first

Find the first row that matches a query. Passes back `undefined` if nothing found.

```javascript
User.first({name: 'Jim', age: 25}, function (err, user) {
  // ...
});
```

#### all

Find all rows that match a query.

```javascript
User.all({age: 25}, function (err, users) {
  // ...
});
```

If you want to limit or skip rows, you can specify that option.

```javascript
User.all({age: 25}, {limit: 10, skip:10}, function (err, users) {
  // ...
});
```

Sorting the rows is a bit awkward at the moment, but it is flexible and simple enough. You specify a order function that takes a [node-sql](https://github.com/brianc/node-sql) table definition.

```javascript
function nameDesc(t) {
  return t.name.desc;
}

User.all({age: 25}, {order: nameDesc}, function (err, users) {
  // ...
});
```

Other order examples:

```javascript
// ORDER BY name
t.name
t.name.asc

// ORDER BY name DESC
t.name.desc;

// ORDER BY name, id DESC
[t.name, t.id.desc]

// ORDER BY name IS NULL
t.name.isNull()
```

##### Operators in queries

In the query of `all` and `first`, you can specify operators such as: in, lt, gte.

```javascript
// Find all users with age greater than or equal to 21
User.all({age: {gte: 21}}, function (err, users) {});

// Find all users with age greater than or equal to 21 but less than 30
User.all({age: {gte: 21, lt: 30}}, function (err, users) {});

// More examples:

{name: {like: "%im"}, age: {lte: 25}}

{employer: {not: null}}
```

Here are a list of available operators:

```
eq
not
gt
gte
lt
lte
like
notLike
in
notIn
```

### Saving data

#### save

To save a new row to the database, you simply use normal objects.

```javascript
var user = {
  name: 'Jim',
  age: 25
};

User.save(user, function (err, savedUser) {
  // savedUser has the properties id, createdAt and updatedAt all set
});
```

To update a row simply fetch it, change it and save it. Only the fields that are changed will be sent to the database. When there are no changes — `beforeSave`, `afterSave` and `afterUpdate` hooks are not fired and no database interaction will happen.

```javascript
User.get(1, function (err, user) {
  if (err) {
    // something like return callback(err);
  }

  user.age++;
  User.save(user, function (err, savedUser) {
    // ...
  });
});
```

You can also specify a where condition that has to match for the update to be successful. This is a great way to ensure a concurrent update doesn't leave things in a strange state.

```javascript
User.get(1, function (err, user) {
  if (err) {
    // something like return callback(err);
  }

  var currentAge = user.age;
  user.age++;

  User.save(user, {age: currentAge} function (err, savedUser) {
    // ...
  });
});
```

#### modify

Since fetching, modifing and saving is such a common pattern SQLBox provides a simple abstraction to help out.

Here is an example of updating a user's age unless they are already older than 29.

```javascript
User.modify(1, {age: {lt: 30}}, function mutator(user) {
  user.age++;
}, function (err, savedUser) {
  // ...
});
```

### Open ended queries

These are lower level interfaces for working with the tables. They do not trigger any hooks, so use them with care.

#### query

Query using the model's internal [node-sql](https://github.com/brianc/node-sql) definition. See the [node-sql](https://github.com/brianc/node-sql) docs for all the good stuff you can do.

```javascript
User.query(function (t) {
  return t.select().where({age: 32});
}, function (err, users) {
  // ...
});
```

#### client

Lastly you can access the database client you created directly.

```javascript
var queryString = 'SELECT * FROM users WHERE id = $1';
var values = [12];

User.client.query(queryString, values, function (err, result) {
  if (err) {
    // ...
  }

  if (result.rows.length) {
    var user = result.rows[0];
  } else {
    // no user found
  }
});
```

Yep, it is that low level. It is just the db client, that one you created in `sqlbox.createClient`. Maybe something higher will be included later.

## Complete example

```javascript
var sqlbox = require('sqlbox');

sqlbox.createClient(function (pg) {
  return new pg.Client('postgres://localhost/database_name');
});

var User = sqlbox.create({
  name: 'user',

  columns: [
    {name: 'name', type: 'string'},
    {name: 'age', type: 'integer'},
    {name: 'email', type: 'string'},
    {name: 'hashedPassword', type: 'string'}
  ],

  validations: {
    name: ['isAlpha']
  }
});

User.save({name: 'Jim', age: '25'}, function (err, user) {
  if (err) {
    return console.log(err);
  }

  // Let's just fetch the user for example's sake
  User.get(user.id, function (err, fetchedUser) {
    if (err) {
      return console.log(err);
    }

    console.log(fetchedUser);
  });
});
```

## Errors

Error handling in SQLBox is simple yet highly effective. All of the method's callbacks will be passed an Error object when an issue arises (standard Node convention). These errors are normal Errors except they have a `code` property. Conveniently, that code matches up with the equivalent HTTP status code. This makes using SQLBox with in a web app super easy, and in other places the error codes are quite memorable.

Example errors that arise and their code's:

* `.get` — if item was not found: `404` not found
* `.save` — if a concurrent update happened: `409` conflict
* `.save` — duplicate insert on unique index: `409` conflict
* `.save` — validation didn't pass: `403` validation error
* `.modify` — ensure failed: `409` conflict
* `.modify` — maxRetries hit: `504` timeout (nothing is wrong, it's just taking too long)
* Unknown or other database errors — `500` internal error

### Express goodness

Using these errors with Express is almost as good as petting a unicorn.

```javascript
app.get('/users/:id', function (req, res, next) {
  User.get(req.params.id, function (err, user) {
    if (err) {
      return next(err);
    }

    res.render('user', {user: user});
  });
});

// ... a billion other routes for your social networking music site ...


// Error handler
app.all('*', function (err, req, res, next) {
  if (err.code) {
    res.status(err.code);
    res.render('errors/' + err.code);
  } else {
    // unknown error
    res.status(500);
    res.render('errors/500');
  }
});
```

# Housekeeping

This software is BSD licensed. <3

Tested on Node 0.10.15 and 0.10.14.


