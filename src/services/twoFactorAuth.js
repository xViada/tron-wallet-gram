const speakeasy = require('speakeasy');
const { generateQRCode } = require('../utils/qrCode');

async function generateTwoFactorAuth() {
    const secret = speakeasy.generateSecret();
    const qrCode = await generateQRCode(secret.otpauth_url);
    return { secret, qrCode: qrCode.toString('base64') };
}

function verifyTwoFactorAuthToken(secret, token) {
    return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 2 // Allow tokens from 2 time steps before and after
    });
}

module.exports = { generateTwoFactorAuth, verifyTwoFactorAuthToken };

