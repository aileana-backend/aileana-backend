const ConduitService = require("./conduit.service");
const User = require("../../models/User");
const { prismadb } = require("../../config/prisma.config");

const conduitService = new ConduitService({
  User,
  WalletAccount: prismadb.wallet,
});

module.exports = conduitService;
