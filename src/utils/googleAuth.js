const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

const verifyGoogleToken = async (token) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID, 
    });
    const payload = ticket.getPayload();
    
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  } catch (error) {
    throw new Error('Invalid Google Token');
  }
};

module.exports = { verifyGoogleToken };