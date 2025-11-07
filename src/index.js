/**
 * Main entry point for the Telegram bot
 */

const { createBot } = require('./bot');
const db = require('./database');
const logger = require('./utils/logger');
const { getConfig } = require('./config');

/**
 * Initialize and start the bot
 */
function main() {
	try {
		// Initialize bot
		const bot = createBot();
		
		// Run cleanup of stale pending states and sessions at startup
		const config = getConfig();
		try {
			db.cleanupOldPendingStates(config.pendingStateTTLHours);
			// Clean up old sessions (default 7 days)
			db.cleanupOldSessions(168);
		} catch (e) {
			logger.error('Initial cleanup failed', { error: e });
		}
		
		// Schedule hourly cleanup of old pending states and sessions
		setInterval(() => {
			try {
				db.cleanupOldPendingStates(config.pendingStateTTLHours);
				// Clean up old sessions (default 7 days)
				db.cleanupOldSessions(168);
			} catch (e) {
				logger.error('Scheduled cleanup failed', { error: e });
			}
		}, 60 * 60 * 1000);
		
		// Gracefully shut down the bot and close database
		process.once('SIGINT', () => {
			bot.stop('SIGINT');
			db.close();
		});
		
		process.once('SIGTERM', () => {
			bot.stop('SIGTERM');
			db.close();
		});
		
		// Launch bot
		bot.launch();
		logger.info('Bot started successfully');
	} catch (error) {
		logger.error('Failed to start bot', { error });
		process.exit(1);
	}
}

// Start the application
main();

