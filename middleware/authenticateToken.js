const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  // Extract the token from the Authorization header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: Missing token' });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, '9031bb4e3f1cad727ba0a59a0bcf53a16f9e1179e520267a98b486f106a256f3'); // Replace 'YOUR_SECRET_KEY' with your actual secret key

    // Attach the decoded token to the request object for further processing
    req.user = decoded.user;

    next(); // Call the next middleware
  } catch (error) {
    return res.status(403).json({ message: 'Unauthorized: Invalid token' });
  }
};

module.exports = authenticateToken;