const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

module.exports = {
  client: "pg",
  connection: process.env.DATABASE_URL || {
    host: process.env.POSTGRES_HOST || "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USERNAME || "postgres",
    password: process.env.POSTGRES_PASSWORD || "password",
    database: process.env.POSTGRES_DATABASE || "aileana",
  },
  pool: { min: 2, max: 10 },
  migrations: {
    tableName: "knex_migrations",
    directory: path.resolve(__dirname, "../migrations"),
  },
  seeds: {
    directory: path.resolve(__dirname, "../seeds"),
  },
};
