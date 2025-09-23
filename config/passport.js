const passport = require("passport");
const jwt = require("jsonwebtoken");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

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

        let user = await User.findOne({ email });

        if (!user) {
          let baseUsername =
            profile.displayName?.replace(/\s+/g, "").toLowerCase() ||
            profile.emails[0].value.split("@")[0];

          let username = baseUsername;
          let exists = await User.findOne({ username });
          while (exists) {
            username = baseUsername + Math.floor(Math.random() * 10000);
            exists = await User.findOne({ username });
          }

          user = await User.create({
            first_name: profile.name.givenName,
            last_name: profile.name.familyName,
            email,
            username,
            termsAccepted: true,
            biometricPreference: "None",
            verified: true,
            gender: "",

            password: "",

            otp: null,
            otpType: "",
            otpExpires: null,

            dob: null,
          });
        }
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
          expiresIn: process.env.JWT_EXPIRES_IN || "7d",
        });

        return done(null, { user, token });
      } catch (err) {
        return done(err, null);
      }
    }
  )
);
