/**

 * Settings action handlers
 */

const db = require('../../database');
const { getSettingsKeyboard, getChangeLanguageKeyboard, getBackToSettingsKeyboard, getMainKeyboard } = require('../keyboards');
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
			const i18next = require('../../config/i18n');
			ctx.t = (key, options = {}) => i18next.t(key, { lng: language.code, ...options });
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

/**
 * Handle initial language selection (for new users on first /start)
 */
async function handleInitialLanguageSelection(ctx) {
	await ctx.answerCbQuery();
	const languageCode = ctx.match[1]; // 'en' or 'es'
	const userId = ctx.from.id;
	
	const language = getAvailableLanguages().find(lang => lang.code === languageCode);
	if (!language) {
		// Fallback to English if invalid language
		db.updateUserLanguageCode(userId, 'en');
		const i18next = require('../../config/i18n');
		ctx.t = (key, options = {}) => i18next.t(key, { lng: 'en', ...options });
		const userName = ctx.from.first_name || 'there';
		await safeEditOrSend(ctx,
			ctx.t('commands.start', { userName }),
			getMainKeyboard(ctx)
		);
		return;
	}
	
	try {
		// Update user's language preference in database
		const success = db.updateUserLanguageCode(userId, language.code);
		
		if (success) {
			// Update ctx.t to use the new language
			const i18next = require('../../config/i18n');
			ctx.t = (key, options = {}) => i18next.t(key, { lng: language.code, ...options });
			
			const userName = ctx.from.first_name || 'there';
			await safeEditOrSend(ctx,
				ctx.t('commands.start', { userName }),
				getMainKeyboard(ctx)
			);
		} else {
			// Fallback to English if update failed
			const i18next = require('../../config/i18n');
			ctx.t = (key, options = {}) => i18next.t(key, { lng: 'en', ...options });
			const userName = ctx.from.first_name || 'there';
			await safeEditOrSend(ctx,
				ctx.t('commands.start', { userName }),
				getMainKeyboard(ctx)
			);
		}
	} catch (e) {
		logger.error('Error updating initial language', { error: e, userId, languageCode: language.code });
		// Fallback to English on error
		const i18next = require('../../config/i18n');
		ctx.t = (key, options = {}) => i18next.t(key, { lng: 'en', ...options });
		const userName = ctx.from.first_name || 'there';
		await safeEditOrSend(ctx,
			ctx.t('commands.start', { userName }),
			getMainKeyboard(ctx)
		);
	}
}

module.exports = {
	handleSettings,
	handleChangeLanguage,
	handleLanguageSelection,
	handleInitialLanguageSelection,
};
