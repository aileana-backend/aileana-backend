exports.up = async (knex) => {
  await knex.raw(`
    CREATE TYPE transaction_type AS ENUM (
      'Deposit',
      'Withdrawal',
      'Transfer'
    );

    CREATE TYPE transaction_flow AS ENUM (
      'Inflow',
      'Outflow'
    );

    CREATE TYPE transaction_status AS ENUM (
      'Pending',
      'Completed',
      'Failed',
      'Reversed'
    );

    CREATE TYPE wallet_status AS ENUM (
      'Active',
      'Frozen',
      'Suspended'
    );
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    DROP TYPE IF EXISTS transaction_type;
    DROP TYPE IF EXISTS transaction_flow;
    DROP TYPE IF EXISTS transaction_status;
    DROP TYPE IF EXISTS wallet_status;
  `);
};
