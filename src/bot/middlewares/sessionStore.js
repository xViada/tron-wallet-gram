/**
 * Database-backed session store for Telegraf sessions
 * This allows sessions to persist across bot restarts
 */

const db = require('../../database');
const logger = require('../../utils/logger');

/**
 * Create a database-backed session store
 * Implements the Telegraf session store interface
 * Telegraf uses string keys for sessions (user IDs converted to strings)
 */
function createSessionStore() {
	return {
		/**
		 * Get session data for a key
		 * @param {string} key - Session key (user ID as string)
		 * @returns {Promise<object|undefined>}
		 */
		async get(key) {
			try {
				// Convert string key to integer for database lookup
				const userId = parseInt(key, 10);
				if (isNaN(userId)) {
					return undefined;
				}
				const session = db.getSession(userId);
				return session || undefined;
			} catch (error) {
				logger.error('Session store: get failed', { error, key });
				return undefined;
			}
		},

		/**
		 * Set session data for a key
		 * @param {string} key - Session key (user ID as string)
		 * @param {object} value - Session data
		 * @returns {Promise<void>}
		 */
		async set(key, value) {
			try {
				// Convert string key to integer for database storage
				const userId = parseInt(key, 10);
				if (isNaN(userId)) {
					logger.warn('Session store: invalid key', { key });
					return;
				}
				db.setSession(userId, value);
			} catch (error) {
				logger.error('Session store: set failed', { error, key });
			}
		},

		/**
		 * Delete session data for a key
		 * @param {string} key - Session key (user ID as string)
		 * @returns {Promise<void>}
		 */
		async delete(key) {
			try {
				// Convert string key to integer for database deletion
				const userId = parseInt(key, 10);
				if (isNaN(userId)) {
					return;
				}
				db.deleteSession(userId);
			} catch (error) {
				logger.error('Session store: delete failed', { error, key });
			}
		}
	};
}

module.exports = { createSessionStore };

