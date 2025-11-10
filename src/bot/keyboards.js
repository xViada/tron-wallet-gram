const { Markup } = require('telegraf');
const { getAvailableLanguages } = require('../utils/getAvailableLanguages');
const db = require('../database/index.js');

function getMainKeyboard(ctx) {
	return Markup.inlineKeyboard([
		[Markup.button.callback(ctx.t('buttons.my_wallets'), 'wallets')],
		[Markup.button.callback(ctx.t('buttons.transactions'), 'transactions')],
		[Markup.button.callback(ctx.t('buttons.settings'), 'settings')],
	]);
}

/**
 * Generate wallets keyboard dynamically
 */
function getWalletsKeyboard(ctx, wallets) {
	const buttons = [];

	// Add buttons for each wallet
	if (wallets && wallets.length > 0) {
		// Sort wallets by created_at in ascending order (oldest first)
		const sortedWallets = [...wallets].sort((a, b) => {
			return new Date(a.created_at) - new Date(b.created_at);
		});

		sortedWallets.forEach((wallet) => {
			// Show label if available, otherwise show truncated address
			const displayText = wallet.label || `${wallet.address.substring(0, 8)}...`;
			buttons.push([
				Markup.button.callback(
					`👛 ${displayText}`,
					`wallet_${wallet.id}`
				)
			]);
		});
	}

	// Add action buttons at the end
	buttons.push([Markup.button.callback(ctx.t('buttons.create_wallet'), 'create_wallet')]);
	buttons.push([Markup.button.callback(ctx.t('buttons.back_to_main'), 'main')]);

	return Markup.inlineKeyboard(buttons);
}

// Keep the static keyboard for backward compatibility or when no wallets exist
function getWalletsKeyboardStatic(ctx) {
	return Markup.inlineKeyboard([
		[Markup.button.callback(ctx.t('buttons.create_wallet'), 'create_wallet')],
		[Markup.button.callback(ctx.t('buttons.back_to_main'), 'main')],
	]);
}

function getBackToWalletsKeyboard(ctx) {
	return Markup.inlineKeyboard([
		[Markup.button.callback(ctx.t('buttons.back_to_wallets'), 'wallets')],
		[Markup.button.callback(ctx.t('buttons.back_to_main'), 'main')],
	]);
}

function getBackToSettingsKeyboard(ctx) {
	return Markup.inlineKeyboard([
		[Markup.button.callback(ctx.t('buttons.back_to_settings'), 'settings')],
		[Markup.button.callback(ctx.t('buttons.back_to_main'), 'main')],
	]);
}

/**
 * Get back to wallet and wallets keyboard
 */
function getBackToWalletAndWalletsKeyboard(ctx, wallet) {
	return Markup.inlineKeyboard([
		[Markup.button.callback(ctx.t('buttons.back_to_wallet', { walletLabel: wallet.label }), `wallet_${wallet.id}`)],
		[Markup.button.callback(ctx.t('buttons.back_to_wallets'), 'wallets')],
		[Markup.button.callback(ctx.t('buttons.back_to_main'), 'main')],
	]);
}


/**
 * Get wallet actions keyboard
 */
function getWalletKeyboard(ctx, wallet) {
	return Markup.inlineKeyboard([
		[Markup.button.callback(ctx.t('buttons.deposit'), `deposit_${wallet.id}`)],
		[Markup.button.callback(ctx.t('buttons.withdraw'), `withdraw_${wallet.id}`)],
		[Markup.button.callback(ctx.t('buttons.transactions'), `transactions_${wallet.id}`)],
		[Markup.button.callback(ctx.t('buttons.delete_wallet'), `delete_wallet_${wallet.id}`)],
		[Markup.button.callback(ctx.t('buttons.change_name'), `change_label_wallet_${wallet.id}`)],
		[Markup.button.callback(ctx.t('buttons.back_to_wallets'), 'wallets')],
	]);
}

/**
 * Get successful withdrawal keyboard
 */
function getSuccesfullWithdrawKeyboard(ctx, transaction, wallet) {
	return Markup.inlineKeyboard([
		[Markup.button.url(ctx.t('buttons.see_on_tronscan'), `https://shasta.tronscan.org/#/transaction/${transaction}`)],
		[Markup.button.callback(ctx.t('buttons.back_to_wallet', { walletLabel: wallet.label }), `wallet_${wallet.id}`)],
		[Markup.button.callback(ctx.t('buttons.back_to_main'), 'main')],
	]);
}

// Settings keyboard
function getSettingsKeyboard(ctx) {
	const buttons = [];
	buttons.push([Markup.button.callback(ctx.t('buttons.change_bot_language'), 'change_language')]);
	if (db.getUserTwoFactorAuthEnabled(ctx.from.id)) {
		buttons.push([Markup.button.callback(ctx.t('buttons.disable_two_factor_auth'), 'disable_two_factor_auth')]);
	} else {
		buttons.push([Markup.button.callback(ctx.t('buttons.enable_two_factor_auth'), 'enable_two_factor_auth')]);
	}
	buttons.push([Markup.button.callback(ctx.t('buttons.back_to_main'), 'main')]);
	return Markup.inlineKeyboard(buttons);
}

// Change language keyboard
function getChangeLanguageKeyboard(ctx) {
	const buttons = getAvailableLanguages().map(lang => [
		Markup.button.callback(`${lang.flag} ${lang.name}`, `change_language_${lang.code}`),
	]);
	buttons.push([Markup.button.callback(ctx.t('buttons.back_to_settings'), 'settings')]);
	return Markup.inlineKeyboard(buttons);
}

// Initial language selection keyboard (for new users on first /start)
function getInitialLanguageKeyboard() {
	const buttons = getAvailableLanguages().map(lang => [
		Markup.button.callback(`${lang.flag} ${lang.name}`, `initial_language_${lang.code}`),
	]);
	return Markup.inlineKeyboard(buttons);
}

// Enable two factor auth keyboard
function getEnableTwoFactorAuthKeyboard(ctx) {
	return Markup.inlineKeyboard([
		[Markup.button.callback(ctx.t('buttons.next_step'), '2fa_enable_next_step')],
		[Markup.button.callback(ctx.t('buttons.cancel'), '2fa_enable_cancel')],
	]);
}

// Disable two factor auth keyboard
function getDisableTwoFactorAuthKeyboard(ctx) {
	return Markup.inlineKeyboard([
		[Markup.button.callback(ctx.t('buttons.cancel'), '2fa_disable_cancel')],
	]);
}

module.exports = {
	getMainKeyboard,
	getWalletsKeyboardStatic,
	getWalletsKeyboard,
	getBackToWalletsKeyboard,
	getBackToWalletAndWalletsKeyboard,
	getWalletKeyboard,
	getSuccesfullWithdrawKeyboard,
	getSettingsKeyboard,
	getChangeLanguageKeyboard,
	getInitialLanguageKeyboard,
	getBackToSettingsKeyboard,
	getEnableTwoFactorAuthKeyboard,
	getDisableTwoFactorAuthKeyboard
};

