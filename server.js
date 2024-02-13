
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const nodemailer = require('nodemailer');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const verifyJwt = require('./middleware/verifyJwt.js'); 
const path = require('path');
const User = require('./models/User.js');
const paymentRoutes = require('./routes/payment');
const bodyParser = require('body-parser');
const fs = require('fs');
const crypto = require('crypto');
const jwtSecret = process.env.JWT_SECRET; // Get from environment 
const { generateAuthToken } = require('./middleware/generateTokenMiddleware.js');



// Assuming you have a middleware for authentication
// Assuming you have a middleware for handling file uploads

const app = express();
// middleware/isAuthenticated.js
app.use(bodyParser.json());
app.use('/api/payment', paymentRoutes);
// Connect to MongoDB Atlas

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });



// User schema and model
// Assuming your User model looks something like this

  

// Passport setup

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  cookie: {
      maxAge: 3 * 30 * 24 * 60 * 60 * 1000 // 3 months in milliseconds
  }
}));
app.use(passport.initialize());
app.use(passport.session());



// JWT token verification middleware

passport.use(new GoogleStrategy({
    clientID:  process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/auth/google/callback'
  },
  (accessToken, refreshToken, profile, done) => {

    const user = {
      
      
      username: profile.displayName,
      emails: profile.emails,
      // Add any other relevant user information
    };
  
    return done(null, user);
  }
  ));
    // Save user profile in your database or perform other actions
   

// Serialize and deserialize user functions
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Use Passport middleware
app.use(passport.initialize());
app.use(passport.session());

const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

// Use the Google OAuth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

async function generateAndPassToken(req, res, next) {
  try {
    // Retrieve user information from the Google profile
    const { id, displayName, emails } = req.user;
    const email = emails && emails.length > 0 ? emails[0].value : null;

    // Find the user in the database based on email
    const user = await User.findOne({ email });
    user.sessionExpiration = Date.now() + 3 * 30 * 24 * 60 * 60 * 1000; // Set expiration
    await user.save();
    
    if (!user) {
      // If the user is not found, redirect to the upload letter page
      return res.redirect('/upload-letter');
    }

    if (!user.isVerified) {
      // If the user is not verified, display a message and possibly resend the verification email
      return res.send('Your account is under verification. Check your email for the verification link.');
    }

    // Generate JWT token
    const token = generateAuthToken({ userId: user._id });

    // Pass the token to the request object
    req.headers.authorization = `Bearer ${token}`;

    // Continue to the next middleware
    next();

  } catch (error) {
    console.error('Authentication Callback Error:', error);
    res.status(500).send('Internal Server Error');
  }
}

app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), generateAndPassToken, (req, res) => {
  // Redirect to the dashboard
  res.redirect('/dashboard');
});



app.get('/login', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

 

app.get('/dashboard/protected-route', isAuthenticated, (req, res) => {
  // Access authenticated user information using req.user
  // ...
  res.send("hello");
});

app.get('/dashboard', async (req, res) => {
  if (req.isAuthenticated()) {
      const user = req.user;
      // Check session expiration time here
      if (user.sessionExpiration < Date.now()) {
          return res.redirect('/login');
      }
      res.render('dashboard', { user });
  } else {
      res.redirect('/login');
  }
});




// ...

// Express middleware


// Routes

  
  app.get('/success', (req, res) => {
    res.send('Upload successful!'); // You can replace this with the content you want to display on the success page
  });
  






const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

  // Updated code for email verification

     
      
     app.get('/upload-letter', (req, res) => {
        res.sendFile(path.join(__dirname, 'verify-letter.html'));
      });
      


      app.post('/upload-letter', upload.single('letter'), isAuthenticated, async (req, res) => {
        try {
          // Check if the user is authenticated
          if (!req.isAuthenticated()) {
            return res.redirect('/');
          }
      
          // Fetch user information
          
          const user = req.user;
          const userEmail = user.emails && user.emails.length > 0 ? user.emails[0].value : 'Unknown';
          //const userName = user.username || 'Unknown';
      
         
          
          // Implement your verification logic here
          const letterPath = req.file.path;
      
          // Implement logic to send verification email using Nodemailer
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.GMAIL_USER,
              pass: process.env.GMAIL_PASSWORD, // Replace with your Gmail password or an App Password
            },
          });
      
          const verificationToken = crypto.randomBytes(20).toString('hex');
          const userName = 'Unknown'; 
          // Save the verification token to the new user in the database
          const newUser = new User({
            username: userName,
            email: userEmail,
            isVerified: false, // Set to false by default, update to true after verification
            verificationToken: verificationToken, // Include the verification token
          });
      
          await newUser.save();
      
          // Update the verification link with the token and username
          const verificationLink = `https://nebula-1zdu.onrender.com/verify-email/${userEmail}/${verificationToken}`;
          const user_Name = user.username;
          const mailOptions = {
            from: process.env.GMAIL_USER,
            to: process.env.GMAIL_USER,
            subject: `New Letter Uploaded - ${user_Name}`,
            text: `A new letter has been uploaded by ${user_Name} (${userEmail}). Please verify it by clicking the following link: ${verificationLink}`,
            attachments: [
              {
                filename: req.file.originalname,
                path: letterPath,
              },
            ],
          };
      
          // Send the email
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error('Error sending email:', error);
              res.status(500).send('Internal Server Error');
            } else {
              console.log('Email sent:', info.response);
              res.send('Letter uploaded successfully! Wait for verification.');
            }
          });
        } catch (error) {
          console.error(error);
          res.status(500).send('Internal Server Error');
        }
      });
// Verification endpoint


// ... (Previous code)

// Verification endpoint
app.get('/verify-email/:email/:token', async (req, res) => {
  try {
    const email = req.params.email;
    const token = req.params.token;

    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).send('User not found');
    }

    // Check if the token matches the user's verificationToken
    if (user.verificationToken === token) {
      // Update the user's isVerified status
      user.isVerified = true;
      user.verificationToken = undefined; // Clear the verification token
      await user.save();
         
      // Send the verification success email
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASSWORD, // Replace with your Gmail password or an App Password
        },
      });

      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: user.email,
        subject: 'Account Verified Successfully',
        text: 'Your account has been successfully verified. You can now log in to access your dashboard.',
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending email:', error);
          res.status(500).send('Internal Server Error');
        } else {
          console.log('Email sent:', info.response);
          res.send('Email verification successful! You can now log in.');
        }
      });
    } else {
      return res.status(403).send('Invalid verification token');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});
app.use(passport.initialize());
app.use(passport.session());
// ... (Remaining code)
app.get('/logout', async (req, res) => {
  try {
    await req.logout((err) => { // Callback function for req.logout()
      if (err) {
        console.error('Error logging out:', err);
        res.status(500).send('Internal Server Error');
      } else {
        res.redirect('/login'); // Redirect to the home page after successful logout
      }
    });
  } catch (err) {
    console.error('Error logging out:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/csv-importer', isAuthenticated, (req, res) => {
  res.redirect('/csv-importer/upload');
});


app.get('/dashboard', (req, res) => {
  if (req.isAuthenticated()) {
    const user = req.user;
    res.render('dashboard', { user });
  } else {
    res.redirect('/login');
  }
});
const csvImporterRouter = require('./routes/csv_imp'); // Adjust the path based on your project structure
app.use('/csv-importer', csvImporterRouter);
 

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});