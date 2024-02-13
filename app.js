const mongoose = require('mongoose');
const passport = require('passport');
const express = require('express');
const session = require('express-session');
const flash = require('express-flash');
const csrf = require('csurf');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const app = express();
//const csrf = require('csrf');
const jwt = require('jsonwebtoken');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const path = require('path');
app.set('view engine', 'ejs');
const profileRouter = require('./routes/profile');
const Team = require('../verificationnebula/models/Team.js');
const TeamMember = require('../verificationnebula/models/TeamMember'); // Adjust the path accordingly
const User = require('../verificationnebula/models/team_users.js');
const authenticateToken = require('../verificationnebula/middleware/authenticateToken');
const isAuthenticated = require('../verificationnebula/middleware/isAuthenticated.js');


function generateSecretKey() {
  return uuidv4();
}

// Session configuration
app.use(session({
  secret: generateSecretKey(),
  resave: true,
  saveUninitialized: true
}));


app.use(flash());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('views', path.join(__dirname, 'views'));

// MongoDB connection
mongoose.connect('mongodb+srv://sai:nebula123@cluster0.l9c5xyp.mongodb.net/?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});


// User schema


app.use(passport.initialize());
app.use(passport.session());



// Passport configuration
passport.use(
  new GoogleStrategy(
    {
      
    clientID: '772787922-vhcqcla66i15hqduocfgb6c9jga9et09.apps.googleusercontent.com',
    clientSecret: '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',
    callbackURL: 'http://localhost:3000/auth/google/callback',
    },async (accessToken, refreshToken, profile, done) => {
     
    
      
      try {
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : '';
        const existingUser = await User.findOne({ googleId: profile.id });

        if (existingUser) {
          return done(null, existingUser);
        }

       
        const newUser = new User({
          googleId: profile.id,
          displayName: profile.displayName,
          gmail: email,
        });

        await newUser.save();
        done(null, newUser);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id)
      .exec()
      .then((user) => {
        done(null, user);
      })
      .catch((err) => {
        done(err, null);
      });
  });
// Express middleware


// Routes
app.get('/', (req, res) => {
  res.send('Hello World!');
});


app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/');
  }
);




app.use('/profile', isAuthenticated);
app.use('/profile', profileRouter);

app.get('/verify-and-fetch', (req, res) => {
  const filePath = path.join(__dirname, './views', 'verify-and-fetch.html');
  res.sendFile(filePath);
});


  app.post('/verify-and-fetch',isAuthenticated,  async (req, res) => {
    try {
      if (!req.headers.authorization) {
        return res.status(401).json({ message: 'Authorization header is missing' });
      }
  
      const token = req.headers.authorization.split(' ')[1]; // Get JWT token from Authorization header
   // Get JWT token from Authorization header
    const decodedToken = jwt.verify(token, 'ecdfb7b331c565acee335e0db2b65b90a527c3676998c5768d61a25cdb88cde8');
    const userEmail = decodedToken.user.gmail; 
    const { collegeName, acceptanceCode } = req.body;
      
      // Find or create user data in team_users collection
      let user = await User.findOne({ gmail: userEmail });
      if (!user) {
        user = new User({ gmail: userEmail });
      }
      user.collegeName = collegeName;
      user.acceptanceCode = acceptanceCode;
      await user.save();
      // Find the teamData based on the user's Gmail, college name, and isVerified condition
      const teamData = await Team.findOne({
        gmail: userEmail,
        collegeName: collegeName,
        acceptanceCode: acceptanceCode,
        isVerified: true
      });
  
      if (teamDetails) {
        res.json({ success: true, teamDetails });
      } else {
        res.json({ success: false, message: 'Team details not found or not verified.' });
      }
      res.json({ success: true, message: 'Verified and fetched data successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  
 
  app.get('/dashboard',isAuthenticated, async (req, res) => {
    try {
      const userEmail = req.user.gmail;
  
      // Check if the user has an acceptance code in team_users collection
      const teamUserData = await User.findOne({
        gmail: userEmail,
        acceptanceCode: { $exists: true, $ne: null },
      });
  
      if (teamUserData) {
        // Redirect to the dashboard if the acceptance code is present
        res.render('dashboard', { user: req.user, teamUserData }); // Adjust this line based on your rendering logic
      } else {
        // Redirect to the verify-and-fetch page if the acceptance code is not present
        res.redirect('/verify-and-fetch');
      }
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  
  });
  


app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
  });
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;