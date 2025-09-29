# Aileana - Backend

## Features

Backend API for the Aileana platform, built with Node.js, Express, and MongoDB.  
This backend integrates with OnePipe v2 API for wallet creation, balance checks, and other transactions.

## Features

- Authentication\*\* (JWT-based)
- User Profile Management\*\*
- Wallet Management\*\*
- OnePipe v2 API Integration\*\*
- Mock & Live modes\*\* (switchable via `.env`)
- this is just to

---

## Setup

1. Clone the repo.
2. `cp .env.example .env` and fill values.
3. `npm install`
4. Start MongoDB locally (or provide a Atlas URI in MONGO_URI).
5. `npm run dev` (requires nodemon) or `npm start`

## Environment variables

See `.env.example`.

## How to test endpoints (Postman )

Using Postman
Import the API collection (create one manually or export from Swagger if available)

Add Authorization: Bearer <token> for protected endpoints

Test endpoints:

Auth
POST /api/auth/signup - Create a new user

POST /api/auth/login - Get JWT token

Profile
GET /api/profile - View profile

PUT /api/profile - Update profile details

Wallet
POST /api/wallet/create - Create wallet for logged-in user

GET /api/wallet/balance - Get wallet balance

Assumptions Made
User must be logged in to create or view a wallet

OnePipe mock/live mode is controlled by .env → ONEPIPE_MOCK_MODE

Provider details (ONEPIPE_PROVIDER_CODE & ONEPIPE_PROVIDER_NAME) are stored in .env to easily switch banks

MongoDB must be running locally or accessible remotely before starting the server
