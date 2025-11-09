/**
 * Command handlers
 */

const db = require('../../database');
const { getMainKeyboard, getInitialLanguageKeyboard } = require('../keyboards');
const {safeEditOrSend} = require('../../utils/messages');

/**
 * Start command handler
 */
async function handleStart(ctx) {
	const user = ctx.from;
	const existingUser = db.getUserById(user.id);
	
	// Check if this is a new user (no existing user or no language set)
	const isNewUser = !existingUser || !existingUser.language_code;
	
	if (!existingUser) {
		db.addUser(user);
	}
	
	// If new user, show language selection
	if (isNewUser) {
		// Use a default language for the initial message (English)
		const defaultT = (key, options = {}) => {
			const i18next = require('../../config/i18n');
			return i18next.t(key, { lng: 'en', ...options });
		};
		await safeEditOrSend(ctx, defaultT('commands.choose_language_welcome'), getInitialLanguageKeyboard());
		return;
	}
	
	// Existing user - show main menu
	const userName = user.first_name || 'there';
	await safeEditOrSend(ctx, ctx.t('commands.start', { userName }), getMainKeyboard(ctx));
}

module.exports = { handleStart };

