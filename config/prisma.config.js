const { PrismaClient } = require("../generated/prisma");
const { encryptText, decryptText } = require("../utils/encrypter");
const { ENCRYPTION_KEY } = require("../const/prisma/secret.const");

const prismaConn = new PrismaClient({});

const prismadb = prismaConn.$extends({
  name: "EncryptingWalletBalances",
  query: {
    wallet: {
      async create({ args, query }) {
        if (args.data.balance) {
          const balance = parseFloat(args.data.balance).toFixed(2).toString();
          args.data.balance = encryptText(balance, ENCRYPTION_KEY);
        }
        return query(args);
      },

      async update({ args, query }) {
        if (args.data.balance) {
          const balance = parseFloat(args.data.balance).toFixed(2).toString();
          args.data.balance = encryptText(balance, ENCRYPTION_KEY);
        }
        return query(args);
      },

      async updateMany({ args, query }) {
        if (args.data.balance) {
          const balance = parseFloat(args.data.balance).toFixed(2).toString();
          args.data.balance = encryptText(balance, ENCRYPTION_KEY);
        }
        return query(args);
      },

      async findFirst({ args, query }) {
        const result = await query(args);
        if (result && result.balance) {
          result.balance = parseFloat(
            decryptText(result.balance, ENCRYPTION_KEY)
          );
        }
        return result;
      },

      async findUnique({ args, query }) {
        const result = await query(args);
        if (result && result.balance) {
          result.balance = parseFloat(
            decryptText(result.balance, ENCRYPTION_KEY)
          );
        }
        return result;
      },

      async findMany({ args, query }) {
        const results = await query(args);
        if (results && Array.isArray(results)) {
          results.forEach((result) => {
            if (result.balance) {
              result.balance = parseFloat(
                decryptText(result.balance, ENCRYPTION_KEY)
              );
            }
          });
        }
        return results;
      },
    },
  },
});

module.exports = { prismadb, prismaConn };
