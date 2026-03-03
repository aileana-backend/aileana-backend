const { WebApi } = require("smile-identity-core");

const smileClient = new WebApi(
  process.env.SMILE_PARTNER_ID,
  process.env.SMILE_CALLBACK_URL, // your webhook url
  process.env.SMILE_API_KEY,
  0, // 0 = sandbox, 1 = production
);

module.exports = smileClient;
