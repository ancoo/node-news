/**
 * DB
 */

var mysql = require('mysql');
var logger = global.nodenews.logger;
var config = global.nodenews.config;


// Connect to MySQL server
var connectParams = {
  host:     config.sql.host,
  port:     config.sql.port,
  user:     config.sql.user,
  password: config.sql.password,
  database: config.sql.database
};
var db = mysql.createConnection(connectParams);
var dbOnError = function (err) {
  if (err) {
    logger.error({source: 'mysql', error: err && err.stack});

    if (/connection lost/img.test(err.toString())) {
      logger.info({source: 'mysql', event: 're-connect'});
      db = mysql.createConnection(connectParams);
      db.connect(dbOnError);
      db.on('error', dbOnError);
    }
  }
};
db.connect(dbOnError);
db.on('error', dbOnError);


/**
 * Parse query parameters
 *
 * @param {Object} params
 * @return {String}
 */
var parseCondition = function (params) {
  var cond = [1];
  for (var key in params) {
    cond.push('`' + key + '`=' + db.escape(params[key]));
  }
  return cond.join(' AND ');
};

/**
 * Parse "ORDER BY" parameters
 *
 * @param {Object} params
 * @return {String}
 */
var parseOrderBy = function (params) {
  var order = [];
  for (var key in params) {
    order.push('`' + key + '` ' + params[key].toUpperCase());
  }
  if (order.length > 0) {
    return 'ORDER BY ' + order.join(', ');
  } else {
    return '';
  }
};

/**
 * Parse "GROUP BY" parameters
 *
 * @param {Array} params
 * @return {String}
 */
var parseGroupBy = function (params) {
  if (params && params.length > 0) {
    return 'GROUP BY ' + params.map(function (item) {
      return '`' + item + '`';
    }).join(', ');
  } else {
    return '';
  }
};

/**
 * Parse "INSERT" parameters
 *
 * @param {String} table
 * @param {Object} data
 * @return {String}
 */
var parseInsert = function (table, data) {
  var fields = [];
  var values = [];
  for (var key in data) {
    fields.push('`' + key + '`');
    values.push(db.escape(data[key]));
   };
  return 'INSERT INTO `' + table + '`(' + fields.join(',') + ') VALUES (' + values.join(',') + ')';
};

/**
 * Parse "UPDATE" parameters
 *
 * @param {String} table
 * @param {String} where
 * @param {Object} data
 * @return {String}
 */
var parseUpdate = function (table, where, data) {
  var update = [];
  for (var key in data) {
    update.push('`' + key + '`=' + db.escape(data[key]));
  };
  return 'UPDATE `' + table + '` SET ' + update.join(',') + ' WHERE ' + where;
};

/**
 * Parse "SELECT" fields
 *
 * @param {Array} fields
 * @return {String}
 */
var parseField = function (fields) {
  if (fields && fields.length > 0) {
    return fields.map(function (item) {
      item = item.trim();
      if (/^[a-zA-Z0-9_]+$/.test(item)) return '`' + item + '`';
      return item;
    }).join(',');
  } else {
    return '*';
  }
};

/**
 * Query and get one row
 *
 * @param {String} table
 * @param {Object} params
 *  - {Object} where
 * @param {Function} callback
 */
exports.getOne = function (table, params, callback) {
  table = config.sql.prefix + table;
  params.where = params.where || {};

  var sql = 'SELECT * FROM `' + table + '` WHERE ' + parseCondition(params.where) + ' LIMIT 1';
  db.query(sql, function (err, rows) {
    var row = (rows && rows.length > 0) ? rows[0] : null;
    callback(err, row);
  });
};

/**
 * Query and get all rows
 *
 * @param {String} table
 * @param {Object} params
 *  - {Integer} page
 *  - {Integer} size
 *  - {Object} where
 *  - {Object} order
 *  - {Object} fields
 *  - {Object} group
 * @param {Function} callback
 */
exports.getList = function (table, params, callback) {
  table= config.sql.prefix + table;
  params.size = parseInt(params.size);
  params.page = parseInt(params.page);
  if (!(params.size > 0)) params.size = 100;
  if (!(params.page > 0)) params.page = 1;
  var offset = (params.page - 1) * params.size;
  params.where = params.where || {};

  var sql = 'SELECT ' + parseField(params.fields) + ' FROM `' + table + '` WHERE ' +
            parseCondition(params.where) + ' ' +
            parseGroupBy(params.group) + ' ' +
            parseOrderBy(params.order) +
            ' LIMIT ' + offset + ',' + params.size;
  // console.log(sql);
  db.query(sql, callback);
};

/**
 * Query and get count
 *
 * @param {String} table
 * @param {Object} where
 * @param {Function} callback
 */
exports.getCount = function (table, where, callback) {
  table = config.sql.prefix + table;
  where = where || {};
  var sql = 'SELECT COUNT(*) AS `c` FROM `' + table + '` WHERE ' + parseCondition(where) + ' LIMIT 1';
  db.query(sql, function (err, rows) {
    var row = (rows && rows.length > 0) ? rows[0] : null;
    callback(err, row && row.c);
  });
};

/**
 * Insert records
 *
 * @param {String} table
 * @param {Object} data
 * @param {Function} callback
 */
exports.insert = function (table, data, callback) {
  var sql = parseInsert(table, data);
  db.query(sql, function (err, results) {
    callback(err, results);
  });
};

/**
 * Delete records
 *
 * @param {String} table
 * @param {Object} where
 * @param {Function} callback
 */
exports.delete = function (table, where, callback) {
  var where = parseCondition(where).trim();
  if (where === '1') return callback(new Error('Warning: This operator will delete all records!'));
  var sql = 'DELETE `' + table + '` WHERE ' + where;
  db.query(sql, function (err, results) {
    callback(err, results);
  });
};

/**
 * Update records
 *
 * @param {String} table
 * @param {Object} where
 * @param {Object} data
 * @param {Function} callback
 */
exports.update = function (table, where, data, callback) {
  var where = parseCondition(where).trim();
  if (where === '1') return callback(new Error('Warning: This operator will modify all records!'));
  var sql = parseUpdate(table, where, data);
  db.query(sql, function (err, results) {
    callback(err, results);
  });
};
