// db.js
const knex = require("knex");
const knexConfig = require("./knex.config");

const db = knex(knexConfig);

module.exports = db;
