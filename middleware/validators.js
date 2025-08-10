const { body, validationResult } = require("express-validator");

const signupRules = [
  body("name").isLength({ min: 2 }),
  body("email").isEmail(),
  body("password").isLength({ min: 6 }),
];

const loginRules = [body("email").isEmail(), body("password").exists()];

const profileUpdateRules = [
  body("name").optional().isLength({ min: 2 }),
  body("phone").optional().isString(),
  body("avatar").optional().isString(),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({ errors: errors.array() });
  next();
};

module.exports = { signupRules, loginRules, profileUpdateRules, validate };
