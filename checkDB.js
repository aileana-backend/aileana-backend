const { Client } = require("pg");
require('dotenv').config();

const client = new Client({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USERNAME,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
});

(async () => {
  await client.connect();
  const res = await client.query(
    "SELECT current_database(), * FROM users LIMIT 1",
  );
  console.log(res.rows);
  await client.end();
})();
