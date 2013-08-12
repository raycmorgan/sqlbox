# Node.js friendly SQL access library

SQLBox is not your typical ORM library like Sequelize, Mongoose, ActiveRecord, etc. It takes a different approach that involves simple function calls and plain (prototype free) objects.

## Main differences

* No class/instance method distinction, just normal node modules and functions.
* No Joins. Simpler queries, easier to scale.
* Plays very nicely with Node and the ecosystem. (strict adherence to the standards)


# State

* Only Postgres is currently supported. Internally uses node-sql to generate queries, so it will be very little work to get MySQL and SQLite working.


# Usage

## Setup SQLBox

### Installation

```bash
$ npm install sqlbox
```

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
* `revision` — This is used to prevent concurrent updates on different versions
* `created_at` — Set when row is inserted, must default to `now()`
* `updated_at` — Updated everytime a row is updated. Should default to `now()`

```sql
CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "revision" integer DEFAULT 1,
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
  tableName: 'users',

  columns: [
    {name: 'name', type: 'string'},
    {name: 'age', type: 'integer'},
    {name: 'email', type: 'string'},
    {name: 'hashedPassword', type: 'string'}
  ]
});
```

With that you have a fully functional model. But before we move onto what you can do with that, let's point out a few things. The `tableName` property is required and must exactly match the database name (underscores and all). The `columns` property is an array defining the custom columns. Note that you don't have to specify the 4 required columns (id, revision, created_at and updated_at). Also note that column name's here are camelCase. When accessing the database sqlbox will use the underscore/lowercase form.

### Alias column names

You can alias a column name to something completely different than the database name by specifing source. Note that source is the exact representation of the database field (underscores, etc).

```javascript
var User = sqlbox.create({
  tableName: 'users',

  columns: [
    {name: 'location', type: 'string', source: 'zip_code_or_state'}
  ]
});
```

### Validations

There are 2 ways to validate a model before it is saved. The simple form:

```javascript
var User = sqlbox.create({
  tableName: 'users',

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

SQLBox uses [node-validator](https://github.com/chriso/node-validator) internally. Because of this you have access to all of the [validation methods](https://github.com/chriso/node-validator#list-of-validation-methods) described there. Simply convert from the normal form `.len(2, 10)` to the array form `['len', 2, 10].

The other more advanced way is to specify `validate` which gets passed the object being validated and a [node-validator](https://github.com/chriso/node-validator) instance to use to validate it.

```javascript
var User = sqlbox.create({
  tableName: 'users',

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

It might look like these two examples are equivalent, but the first will give you an error message with a lot more details on what was expected and what failed. You should always prefer it over the validate method. Use validate when you have very custom logic.

### Hooks

Hooks let you specify custom logic when certain things have happened. The currently available hooks:

* beforeSave — Called before both creates and updates
* afterSave — Called after both creates and updates
* afterUpdate
* afterCreate

```javascript
var User = sqlbox.create({
  tableName: 'users',

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

You can specify zero, one, or more hooks in the `hooks` object. The values should be either a single function or an array of functions to call one at a time when a hook is triggered. The hook functions must be in the form: `function (obj, callback)` where obj is the obj being saved. The second argument `callback` is a function that must be invoked and takes one optional argument `err` you can pass in if something went wrong.

#### Save hooks

When saving an object, the following hooks will be called in this order: `beforeSave, afterUpdate (or) afterCreate, afterSave`.

All hooks and the actual save are by default contained in a SQL transaction. This allows you to do things like save related models in safety knowing that if anything goes wrong the database will be in a consitent state. Sometimes you don't want this behavior (reaching out to a lot of external services or something), to disable the tansaction pass the option: transaction. (this actually doesn't work yet, soon)


## Database interaction

### Getting rows

Get a single row by id. If it is not found an error with code 404 will be passed back.

```javascript
User.get(1, function (err, user) {
  // ...
});
```

Get multiple rows by ids. Missing ids just won't return anything. If no ids exist, an empty array is passed back.

```javascript
User.mget([1, 2, 3], function (err, users) {
  // ...
});
```

Find the first row that matches a simple query. Passes back `undefined` if nothing found.

```javascript
User.first({name: 'Jim', age: 25}, function (err, user) {
  // ...
});
```

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

### Saving data

To save a new row to the database, you simply use normal objects.

```javascript
var user = {
  name: 'Jim',
  age: 25
};

User.save(user, function (err, savedUser) {
  // savedUser has the properties id, revision, createdAt and updatedAt all set
});
```

To update a row simply fetch it change it and save it.

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

Since fetching, modifing and saving is such a common pattern SQLBox provides a simple and very powerful abstraction to help out.

`modify`. This is a special function. You describe what object to fetch, what it should look like and how to change it. With that information, SQLBox will fetch the object, make sure it passes your tests and attempt to save it. If another client concurrently updated the object, this process will be repeated a number of times (or if your tests no longer pass). This makes it super easy to make sure that you are modifying the row as you see it, without the overhead of a transaction.

```javascript
var opts = {
    ensures: [ function (user) { return user.age < 30; } ],
    maxRetries: 5 // defaults to 3
};

User.modify(1, )

User.get(1, opts, function mutator(user) {
  user.age++;
}, function (err, savedUser) {
  // ...
});
```

#### Important note about modify

The ensure functions and mutator function (3rd argument) should not have any side effects. They can be called one or many times, so those side effects will happen an underdetermined amount of times. The callback (last argument) is the place to do things once the save is complete.

Note: the beforeSave hook will be called each time. Rememeber that the save hooks are within a transaction, so usually this is fine, though working with external services should probably only be done in the after* hooks.

#### Future modify changes

Thinking that an option transation: true would force both the get and save into a transaction. This would ensure only 1 try, but incur the locking overhead.

### Open ended queries

These are lower level interfaces for working with the tables. They do not trigger any hooks, so use the with care.

Query using the model's internal [node-sql](https://github.com/brianc/node-sql) definition. See the [node-sql](https://github.com/brianc/node-sql) docs for all the good stuff you can do.

```javascript
User.query(function (t) {
  return t.select().where({age: 32});
}, function (err, users) {
  // ...
});
```

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
}
}
});
```

Yep, it is as low level as that. Exactly the same as just having just the db connection. Maybe something higher will be included later.

## Complete Example

```javascript
var sqlbox = require('sqlbox');

sqlbox.createClient(function (pg) {
  return new pg.Client('postgres://localhost/database_name');
});

var User = sqlbox.create({
  tableName: 'users',

  columns: [
    {name: 'name', type: 'string'},
    {name: 'age', type: 'integer'},
    {name: 'email', type: 'string'},
    {name: 'hashedPassword', type: 'string'}
  ],

  validations: {
    name: ['isAlpha']
  }
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

Error handling in SQLBox is simple yet highly effective. All method's callbacks can be passed an Error object when an issue arises (standard Node convention). These errors are pretty typical errors except they have a code field. Conveniently the code just happens to match up with what the HTTP status code equivalent is. This makes using SQLBox with in a web app super easy, and in other places the error codes are at the very least, memorable.

Example errors that arise and their code's:

* `.get` — if item was not found: `404` not found
* `.save` — if concurrent change happend: `409` conflict
* `.save` — duplicate insert on unique index: `409` conflict
* `.save` — validation didn't pass: `403` validation error
* `.modify` — ensure failed: `409` conflict
* `.modify` — maxRetries hit: `504` timeout, nothing is wrong, it's just taking too long
* Unknown or other database errors — `500` server error

### Express goodness

Using these errors with Express almost as good as petting a unicorn.

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


