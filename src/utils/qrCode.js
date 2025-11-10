const QRCode = require('qrcode');
const { asAppError } = require('./errors');

/**
 * Generate QR code buffer from data
 */
async function generateQRCode(data) {
    try {
      // Generate QR code as a buffer (PNG format)
      const qrBuffer = await QRCode.toBuffer(data, {
        type: 'png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      return qrBuffer;
    } catch (error) {
      throw asAppError(error, 'QR_GEN_FAILED', 'Could not generate QR code.');
    }
  }

module.exports = { generateQRCode };
