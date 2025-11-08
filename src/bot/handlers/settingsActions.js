/**

 * Settings action handlers
 */

const db = require('../../database');
const { getSettingsKeyboard, getChangeLanguageKeyboard, getBackToSettingsKeyboard } = require('../keyboards');
const { safeEditOrSend } = require('../../utils/messages');
const logger = require('../../utils/logger');
const { getAvailableLanguages } = require('../../utils/getAvailableLanguages');

/**
 * Handle settings action - show settings menu
 */
async function handleSettings(ctx) {
	await ctx.answerCbQuery();
	await safeEditOrSend(ctx, ctx.t('buttons.settings'), getSettingsKeyboard(ctx));
}

/**
 * Handle change language action - show language selection
 */
async function handleChangeLanguage(ctx) {
	await ctx.answerCbQuery();
	const keyboard = getChangeLanguageKeyboard(ctx);	
	await safeEditOrSend(ctx, ctx.t('settings.choose_language'), keyboard);
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
		await safeEditOrSend(ctx, ctx.t('settings.language_change_invalid'), getBackToSettingsKeyboard(ctx));
		return;
	}
	try {
		// Update user's language preference in database
		const success = db.updateUserLanguageCode(userId, language.code);
		
		if (success) {
			await safeEditOrSend(ctx,
				ctx.t('settings.language_changed', { language: language.name }),
				getBackToSettingsKeyboard(ctx)
			);
		} else {
			await safeEditOrSend(ctx,
				ctx.t('settings.language_change_error'),
				getBackToSettingsKeyboard(ctx)
			);
		}
	} catch (e) {
		logger.error('Error updating language', { error: e, userId, languageCode: language.code });
		await safeEditOrSend(ctx,
			ctx.t('settings.language_change_error'),
			getBackToSettingsKeyboard(ctx)
		);
	}
}

module.exports = {
	handleSettings,
	handleChangeLanguage,
	handleLanguageSelection,
};
