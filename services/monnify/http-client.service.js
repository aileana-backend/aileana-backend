const BaseRequestService = require("./base-request.service");
const ENDPOINTS = require("../../const/monnify/endpoints.const");
const sessionCacheUtil = require("../../utils/monnify/session-cache.util");

class HttpClientService extends BaseRequestService {
  constructor() {
    super(ENDPOINTS.BASE_URL, ENDPOINTS.apiKey);

    // Lets authenticate with Monnify and get a token then reset the Authorization header
    const apiKey = ENDPOINTS.apiKey;
    const secretKey = ENDPOINTS.secretKey;
    const authString = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");

    this.client.defaults.headers["Authorization"] = `Basic ${authString}`;

    // We will use session cache to retrieve the token if it exists and is not expired
    this.client.interceptors.request.use(async (config) => {
      // make sure this interceptor don'ts apply to login endpoint
      if (config.url === ENDPOINTS.AUTH.RequestAccessToken) {
        return config;
      }

      const token = sessionCacheUtil.get("monnify_token");
      const tokenExpiry = sessionCacheUtil.get("monnify_token_expiry");

      if (token && tokenExpiry) {
        const now = new Date();
        const expiryDate = new Date(tokenExpiry);

        if (now < expiryDate) {
          config.headers["Authorization"] = `Bearer ${token}`;
          return config;
        }
      }

      // If no valid token, authenticate and get a new one
      const newToken = await this.authenticate();
      config.headers["Authorization"] = `Bearer ${newToken}`;
      return config;
    });
  }

  async authenticate() {
    try {
      const response = await this.client.post(
        ENDPOINTS.AUTH.RequestAccessToken
      );
      const token = response.data.responseBody.accessToken;
      const expiresIn = response.data.responseBody.expiresIn;
      // Convert to date object
      const expiryDate = new Date(Date.now() + expiresIn * 1000);

      // we're going to cache the token to session cache
      sessionCacheUtil.set("monnify_token", token);
      sessionCacheUtil.set("monnify_token_expiry", expiryDate.toISOString());

      this.client.defaults.headers["Authorization"] = `Bearer ${token}`;
      return token;
    } catch (error) {
      this.handleError(error);
    }
  }
}

module.exports = HttpClientService;
