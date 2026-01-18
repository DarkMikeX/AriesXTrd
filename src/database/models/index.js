/**
 * Database Models Index
 * Exports all database models
 */

const User = require('./User');
const Trade = require('./Trade');
const Signal = require('./Signal');
const Settings = require('./Settings');
const Performance = require('./Performance');

module.exports = {
  User,
  Trade,
  Signal,
  Settings,
  Performance
};