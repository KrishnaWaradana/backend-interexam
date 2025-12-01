// src/utils/googleAuth.js
const { OAuth2Client } = require('google-auth-library');

// Client ID kamu
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '188569866516-3d2i3kb896epd7ucac1ukjcdnakmdctl.apps.googleusercontent.com';

const client = new OAuth2Client(CLIENT_ID);

const verifyGoogleToken = async (token) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID, 
    });
    const payload = ticket.getPayload();
    
    // Mengembalikan data penting dari Google
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      email_verified: payload.email_verified
    };
  } catch (error) {
    throw new Error('Invalid Google Token');
  }
};

module.exports = { verifyGoogleToken };