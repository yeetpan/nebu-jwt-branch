const jwt = require('jsonwebtoken');

function verifyJwt(req, res, next) {
  // Get the token from the request header or query parameter
  const token = req.headers.authorization || req.query.token;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: Missing token' });
  }

  // Verify the JWT token
  jwt.verify(token, '9031bb4e3f1cad727ba0a59a0bcf53a16f9e1179e520267a98b486f106a256f3', (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }

    // Store the decoded user information in the request object
    req.user = decoded.user;
    next();
  });
}

module.exports = verifyJwt;