const { OAuth2Client } = require('google-auth-library');

const verifyGoogleToken = async (token) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const client = new OAuth2Client(clientId);

    // Izinkan Client ID dari .env maupun Client ID baru / lama
    const allowedAudiences = [
      clientId,
      '686000565049-unee3nk2g89vkbd6n5bvv15do1g93feo.apps.googleusercontent.com',
      '972513524217-kk7nu2dgqra50kjsgad7ipouc7blji3c.apps.googleusercontent.com'
    ].filter(Boolean);

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: allowedAudiences, 
    });
    const payload = ticket.getPayload();
    
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  } catch (error) {
    console.error('Detail Error Verifikasi Google Token:', error);
    throw new Error(`Invalid Google Token: ${error.message}`);
  }
};

module.exports = { verifyGoogleToken };