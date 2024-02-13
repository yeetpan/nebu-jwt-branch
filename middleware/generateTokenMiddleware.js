const jwt = require('jsonwebtoken');
require('dotenv').config();

// Replace 'YOUR_SECRET_KEY_HERE' with your actual secret key
const jwtSecret = process.env.JWT_SECRET;  

const generateAuthToken = (user) => {
  return jwt.sign({ user }, jwtSecret, { expiresIn: '1h' });
};

const generateTokenMiddleware = (req, res, next) => {
  const token = generateAuthToken(req.user);
  req.token = token;
  next();
};

module.exports = { generateAuthToken, generateTokenMiddleware };