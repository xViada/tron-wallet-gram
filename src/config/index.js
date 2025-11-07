require('dotenv').config();

/**
 * Environment configuration and validation
 */

/**
 * Validate environment variables at startup
 */
function validateEnvVars() {
  const errors = [];
  
  // Validate BOT_TOKEN
  if (!process.env.BOT_TOKEN) {
    errors.push('BOT_TOKEN is required but not set');
  } else if (typeof process.env.BOT_TOKEN !== 'string' || process.env.BOT_TOKEN.trim().length === 0) {
    errors.push('BOT_TOKEN must be a non-empty string');
  } else {
    // Telegram bot tokens follow the pattern: numbers:letters
    const botTokenPattern = /^\d+:[A-Za-z0-9_-]+$/;
    if (!botTokenPattern.test(process.env.BOT_TOKEN)) {
      errors.push('BOT_TOKEN has invalid format. Expected format: numbers:letters');
    }
  }
  
  // If there are errors, log them and exit
  if (errors.length > 0) {
    console.error('❌ Environment variable validation failed:');
    errors.forEach((error, index) => {
      console.error(`  ${index + 1}. ${error}`);
    });
    console.error('\nPlease check your .env file and ensure all required variables are set correctly.');
    process.exit(1);
  }
  
  console.log('✅ Environment variables validated successfully');
}

/**
 * Get configuration values
 */
function getConfig() {
  return {
    botToken: process.env.BOT_TOKEN,
    databasePath: process.env.DATABASE_PATH || 'users.db',
    tronNetwork: process.env.TRON_NETWORK || 'https://api.shasta.trongrid.io',
    pendingStateTTLHours: parseInt(process.env.PENDING_STATE_TTL_HOURS || '24', 10),
  };
}

// Run validation before exporting
validateEnvVars();

module.exports = {
  validateEnvVars,
  getConfig,
};

