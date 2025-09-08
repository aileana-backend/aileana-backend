// Import with `const Sentry = require("@sentry/nestjs");` if you are using CJS
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN, // Replace with your Sentry DSN
  environment: process.env.NODE_ENV || 'development', // Set the environment (e.g., development, production)
  integrations: [
    // Add our Profiling integration
    nodeProfilingIntegration(),
  ],
  debug: false, // Enable debug mode for Sentry

  // TracesSampleRate controls the sample rate for performance monitoring
  tracesSampleRate: 1.0, // Adjust this value as needed (0.0 to 1.0)
  // This is the percentage of transactions that will be sent to Sentry.
  // A value of 1.0 means 100% of transactions will be sent, while 0.1 means 10%.

  // Adjust this value based on your application's performance and data volume.
  profilesSampleRate: 1.0, // Adjust this value as needed (0.0 to 1.0)

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});
