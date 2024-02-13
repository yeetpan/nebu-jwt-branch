const jwt = require('jsonwebtoken');
const { generateTokenMiddleware, generateAuthToken } = require('../middleware/generateTokenMiddleware');

const jwtSecret = process.env.JWT_SECRET; // Assuming you have defined the JWT secret

const isAuthenticated = (req, res, next) => {
    // Extract the JWT token from the request headers
    const token = req.headers.authorization;

    if (!token) {
        // If token is missing, generate a new token using generateTokenMiddleware
        generateTokenMiddleware(req, res, () => {
            // Token generated, proceed to the next middleware
            next();
        });
    } else {
        // Verify the JWT token
        jwt.verify(token.split(' ')[1], jwtSecret, (err, decoded) => {
            if (err) {
                return res.status(401).json({ message: 'Unauthorized: Invalid token' });
            }

            // If the token is valid, proceed to the next middleware
            // You can also attach the decoded user information to the request object if needed
            req.user = decoded.user;
            next();
        });
    }
};


module.exports = isAuthenticated;
