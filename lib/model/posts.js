/**
 * Posts model
 */

var db = global.nodenews.db;
var cache = global.nodenews.cache;
var config = global.nodenews.config;
var utils = require('../utils');


/**
 * Add post
 *
 * @param {Object} post
 * @param {Function} callback
 */
exports.add = function (post, callback) {
  db.insert('posts', post, function (err, results) {
    if (err) return callback(err);
    post.id = results.insertId;
    callback(null, post);
  });
};

/**
 * Get post
 *
 * @param {String} url
 * @param {Function} callback
 */
exports.getByUrl = function (url, callback) {
  db.getOne('posts', {url: url}, function (err, post) {
    callback(err, post || null);
  });
};

/**
 * Update post
 *
 * @param {String} url
 * @param {Object} post
 * @param {Function} callback
 */
exports.updateByUrl = function (url, post, callback) {
  db.update('posts', {url: url}, post, function (err, results) {
    callback(err, results && results.affectedRows);
  });
};