const express = require('express');
const multer = require('multer');
const csv = require('fast-csv');
const mongoose = require('mongoose');
const path = require('path');
const nodemailer = require('nodemailer'); 
const hCaptcha = require('hcaptcha');
const qrcode = require('qrcode');
const jwt = require('jsonwebtoken'); 
const router = express.Router();
const app = express();
const Team = require('../models/Team.js');
app.set('view engine', 'ejs');
const { generateTokenMiddleware, generateAuthToken } = require('../middleware/generateTokenMiddleware');
const isAuthenticated = require('../middleware/isAuthenticated.js')

let records = [];

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });




function generateRandomToken() {
  const isVerified = Math.random() < 0.8; // Adjust the verification probability as needed
  const token = isVerified ? Math.random().toString(36).substring(7) : null;
  return { isVerified, token };
}

function generateRandomAcceptanceCode(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let acceptanceCode = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    acceptanceCode += characters.charAt(randomIndex);
  }

  return acceptanceCode;
}
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'contact.nebulaapparel@gmail.com',
          pass: 'pgfksxpluzffqifj',
  },
});


function generateRandomTokenAndAcceptanceCode() {
  const isVerified = Math.random() < 0.8;
  const token = Math.random().toString(36).substring(7);
  const acceptanceCode = generateRandomAcceptanceCode(10);

  return { isVerified, token, acceptanceCode };
}



// hCaptcha site key and secret key, replace with your own keys
const hCaptchaSiteKey = 'bff69a4b-86c1-420a-b695-f43a111ec895';
const hCaptchaSecretKey = 'ES_f4688df581fe4d4e9578bf100f4adc4b';

router.get('/upload', isAuthenticated, (req, res) => {
  res.set('Cache-Control', 'no-store'); // or 'no-cache'
  res.render('upload_csv');
});


function generateQRCodeData(objectId) {
  // Replace this with your actual implementation to generate QR code data
  return `http://your-website-url/nebula/dashboard/profile/${objectId}`; // Example placeholder
}
router.get('/nebula/dashboard/profile/:objectId', async (req, res) => {
  try {
    const objectId = req.params.objectId;

    // Fetch team user data based on objectId
    const teamUser = await Team.findOne({ _id: objectId });

    if (!teamUser) {
      return res.status(404).send('Team user not found.');
    }

    // Render a profile template (replace 'profile_template' with your actual template name)
    res.render('profile_template', { teamUser });
  } catch (error) {
    console.error('Error fetching team user data:', error);
    res.status(500).send('Internal Server Error');
  }
});










  router.post('/upload', isAuthenticated, upload.single('csvFile'), async (req, res) => {
   const adminToken = generateRandomToken();
   const emailDataForAdmin = [];
    try {
      const teamName = req.body.teamname;

      // Ensure team name is provided
      if (!teamName) {
          return res.status(400).send('Team Name is required.');
      }
    if (req.session.uploadedCSV) {
      // CSV has already been uploaded, redirect to display page
      return res.redirect('/csv-importer/display');
    }

    if (!req.file) {  
      return res.status(400).send('No file uploaded.');
    }

    const fileBuffer = req.file.buffer.toString();

    // Parse CSV and store records in the global variable
    records = await parseCSV(fileBuffer);
    
    if (!records || records.length === 0) {
      return res.status(400).send('No valid records found in the CSV file.');
    }
    const userEmail = req.user.emails && req.user.emails.length > 0 ? req.user.emails[0].value : 'Unknown';

    const existingRecords = await Team.find({ adminGmail: userEmail });
    if (existingRecords && existingRecords.length > 0) {
      return res.redirect('/csv-importer/display');
    }

    


    // Save records to MongoDB using the Mongoose model (Team)
   
   
    
    //const adminToken = generateRandomToken();

    
    const allTeamMembers = [];
    for (const record of records) {
      const { isVerified, token, acceptanceCode } = generateRandomTokenAndAcceptanceCode();
     
      let uniqueToken = token;
      while (await Team.exists({ token: uniqueToken })) {
          uniqueToken = generateRandomTokenAndAcceptanceCode().token;
      }

      // Assign unique token and team name to the record
      record.token = uniqueToken;
      record.acceptanceCode = acceptanceCode;
      record.adminGmail = userEmail;
      record.teamName = teamName;


      
    
    // Extract 'teamName' from the form data
    

    // Create the Team document with 'teamName'
   
    const teamMember = await Team.create(record);
      allTeamMembers.push(teamMember);
      
      
      const objectId = teamMember._id;
      const qrData = generateQRCodeData(objectId); 
      
     
      //await sendEmailToAdmin('contact.nebulaapparel@gmail.com', adminToken, allTeamMembers);
      qrcode.toFile(`./qrcodes/${objectId}.png`, qrData, (err) => {
        if (err) {
          console.error('Error generating QR code:', err);
        } else {
          // Use record.username and record.gmail for personalized email
          const mailOptions = {
            from: 'contact.nebulaapparel@gmail.com',
            to: record.gmail,
            subject: 'Acceptance Code and Profile QR Code',
            text: `Dear ${record.username},\n\nYour acceptance code is: ${record.acceptanceCode}\n\nPlease find your profile QR code attached.\n\nBest regards,\nThe Nebula Apparel Team`,
            
          };

          try {
            transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                console.error('Error sending email:', error);
              } else {
                console.log('Email sent to team member:', record.gmail);
              }

              emailDataForAdmin.push({
                username: record.username,
                gmail: record.gmail,
                qrCodePath: `./qrcodes/${objectId}.png`,
              });
            });
          } catch (error) {
            console.error('Error sending email:', error);
          }
        }
      });
     
    }
    await Promise.all(allTeamMembers);
    try {
      
    await sendEmailToAdmin('contact.nebulaapparel@gmail.com', adminToken, allTeamMembers);

   } catch (error) {
     console.error('Error sending email to admin:', error);
    }
  



   res.redirect(303, '/csv-importer/display');
    } catch (error) {
     console.error('Error processing CSV upload:', error);
     res.status(500).send('Internal Server Error');
    }
});


async function sendEmailToTeamMember(email, acceptanceCode, objectId) {
  const profileURL = `http://your-website-url/nebula/dashboard/profile/${objectId}`;
  const mailOptions = {
    from: 'contact.nebulaapparel@gmail.com',
    to: email,
    subject: 'Acceptance Code Information',
    text: `Dear Team Member,\n\nYour acceptance code is: ${acceptanceCode}\n\nProfile URL: ${profileURL}\n\nBest regards,\nThe Nebula Apparel Team`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent to team member:', email);
  } catch (error) {
    console.error('Error sending email to team member:', error);
  }
}
      
async function sendEmailToAdmin(adminEmail, adminToken, teamMembers) {
  try {
    const mailOptions = {
      from: 'contact.nebulaapparel@gmail.com',
      to: 'contact.nebulaapparel@gmail.com',
      subject: 'Team Members QR Codes and Information',
      text: `Dear Admin,\n\nYour admin token is: ${adminToken}\n\nHere are the QR Codes and Information for each team member:\n\n`,
      attachments: [],
    };

    // Attach QR codes and information for each team member
    for (const teamMember of teamMembers) {
      const objectId = teamMember._id;
      const qrData = generateQRCodeData(objectId);
      const memberInfo = `Username: ${teamMember.username}, Gmail: ${teamMember.gmail}, QR Code: ${qrData}\n\n`;

      mailOptions.text += memberInfo;

      // Attach QR code as an attachment
      mailOptions.attachments.push({
        filename: `${objectId}.png`,
        path: `./qrcodes/${objectId}.png`,
        cid: `qrcode${objectId}`,
      });
    }

    await transporter.sendMail(mailOptions);
    console.log('Email sent to admin:', adminEmail);
  } catch (error) {
    console.error('Error sending email to admin:', error);
  }
}










      // Set session variables in the finally block

      
  
     // Send email to team member
     

  
  
    //await Team.insertMany(records);
    //req.session.adminToken = records[0].token; 
    

    // Use 303 See Other status to redirect after POST
   


    

// Send email to admin



router.get('/display', isAuthenticated, async (req, res) => {
  try {
    const userEmail = req.user.emails && req.user.emails.length > 0 ? req.user.emails[0].value : 'Unknown';

    // If the user has uploaded a CSV, fetch their data
    if (req.session.uploadedCSV) {
      const recordsFromUser = await Team.find({ adminGmail: userEmail });
      res.render('display_csv', { records: recordsFromUser, successMessage: '' });
      return;
    }

    // Otherwise, check if the admin has data in the database
    const recordsFromDB = await Team.find({ adminGmail: userEmail });
    if (recordsFromDB && recordsFromDB.length > 0) {
      res.render('display_csv', { records: recordsFromDB, successMessage: '' });
      return;
    }

    // If no data is found, allow access to the upload route
    res.redirect('/csv-importer/upload');

  } catch (error) {
    console.error('Error fetching records:', error);
    res.status(500).send('Internal Server Error');
  }
});








// Function to send email to admin


// router.get('/display', isAuthenticated, async (req, res) => {
 // try {
    // Fetch all records without using the adminToken
   // const recordsFromDB = await Team.find({});
    //res.render('display_csv', { records: recordsFromDB, successMessage: '' });
  //} catch (error) {
   // console.error('Error fetching records:', error);
    //res.status(500).send('Internal Server Error');
  //}
// });


router.post('/delete-all', isAuthenticated, async (req, res) => {
  try {
    const token = req.body['h-captcha-response'];

    if (!token) {
      return res.status(400).send('hCaptcha verification failed.');
    }

    // Verify hCaptcha token
    const { success } = await hCaptcha.verify(hCaptchaSecretKey, token);

    if (!success) {
      return res.status(400).send('hCaptcha verification failed.');
    }

    if (!req.isAuthenticated()) {
      return res.redirect('/login');
    }

    // Delete all records from the MongoDB collection using Mongoose
    await Team.deleteMany({});
    await TeamMember.deleteMany({});
    // Redirect to the display page or any other appropriate page
    res.redirect('/upload');
  } catch (error) {
    console.error('Error deleting all records:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/delete-all', isAuthenticated, async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.redirect('/login');
    }
    // Delete all records from the MongoDB collection using Mongoose
    await Team.deleteMany({});
    // Assuming TeamMember is another model, remove this line if not needed
    // await TeamMember.deleteMany({});
    
    // Redirect to the display page or any other appropriate page
    res.redirect('/csv-importer/display');
  } catch (error) {
    console.error('Error deleting all records:', error);
    res.status(500).send('Internal Server Error');
  }
});


router.post('/delete-single/:id', isAuthenticated, async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.redirect('/login');
    }

    const recordId = req.params.id;

    // Delete the single record from the MongoDB collection using Mongoose
    await Team.findByIdAndDelete(recordId);

    // Redirect to the display page or any other appropriate page
    res.redirect('/csv-importer/display');
  } catch (error) {
    console.error('Error deleting a single record:', error);
    res.status(500).send('Internal Server Error');
  }
});


async function parseCSV(csvString) {
  return new Promise((resolve, reject) => {
    const parsedRecords = [];
    csv.parseString(csvString, { headers: true })
      .on('data', (data) => parsedRecords.push(data))
      .on('end', () => resolve(parsedRecords))
      .on('error', (error) => reject(error));
  });
}

module.exports = router;