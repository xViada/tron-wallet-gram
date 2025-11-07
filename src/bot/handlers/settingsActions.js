/**

 * Settings action handlers
 */

const db = require('../../database');
const { settingsKeyboard, getChangeLanguageKeyboard, backToSettingsKeyboard } = require('../keyboards');
const { safeEditOrSend } = require('../../utils/messages');
const logger = require('../../utils/logger');
const { getAvailableLanguages } = require('../../utils/getAvailableLanguages');

/**
 * Handle settings action - show settings menu
 */
async function handleSettings(ctx) {
	await ctx.answerCbQuery();
	await safeEditOrSend(ctx, '⚙️ Settings:', settingsKeyboard);
}

/**
 * Handle change language action - show language selection
 */
async function handleChangeLanguage(ctx) {
	await ctx.answerCbQuery();
	const keyboard = getChangeLanguageKeyboard();	
	await safeEditOrSend(ctx, 'Please choose your language:', keyboard);
}

/**
 * Handle language selection
 */
async function handleLanguageSelection(ctx) {
	await ctx.answerCbQuery();
	const languageCode = ctx.match[1]; // 'en' or 'es'
	const userId = ctx.from.id;
	
	const language = getAvailableLanguages().find(lang => lang.code === languageCode);
	if (!language) {
		await safeEditOrSend(ctx, '❌ Invalid language code.', backToSettingsKeyboard);
		return;
	}
	try {
		// Update user's language preference in database
		const success = db.updateUserLanguageCode(userId, language.code);
		
		if (success) {
			await safeEditOrSend(ctx,
				`✅ Language changed to ${language.name}.`,
				backToSettingsKeyboard
			);
		} else {
			await safeEditOrSend(ctx,
				'❌ Failed to update language. Please try again.',
				backToSettingsKeyboard
			);
		}
	} catch (e) {
		logger.error('Error updating language', { error: e, userId, languageCode: language.code });
		await safeEditOrSend(ctx,
			'❌ Error updating language. Please try again.',
			backToSettingsKeyboard
		);
	}
}

module.exports = {
	handleSettings,
	handleChangeLanguage,
	handleLanguageSelection,
};
