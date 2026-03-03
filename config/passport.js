const passport = require("passport");
const jwt = require("jsonwebtoken");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const knex = require("../config/pg");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;

        let user = await knex("users").where({ email }).first();

        if (!user) {
          let baseUsername =
            profile.displayName?.replace(/\s+/g, "").toLowerCase() ||
            email.split("@")[0];

          let username = baseUsername;
          let exists = await knex("users").where({ username }).first();

          while (exists) {
            username = baseUsername + Math.floor(Math.random() * 10000);
            exists = await knex("users").where({ username }).first();
          }

          const [newUser] = await knex("users")
            .insert({
              first_name: profile.name.givenName,
              last_name: profile.name.familyName,
              email,
              username,
              terms_accepted: true,
              biometric_preference: "None",
              verified: true,
              password: "",
              otp: null,
              otp_type: "",
              otp_expires: null,
              created_at: new Date(),
              updated_at: new Date(),
            })
            .returning("*");

<<<<<<< HEAD
            password: "",

            otp: null,
            otpType: "",
            otpExpires: null,
          });
=======
          user = newUser;
>>>>>>> payment
        }

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
          expiresIn: process.env.JWT_EXPIRES_IN || "7d",
        });

        return done(null, { user, token });
      } catch (err) {
        return done(err, null);
      }
    },
  ),
);
