const { Markup } = require('telegraf');
const { getAvailableLanguages } = require('../utils/getAvailableLanguages');

const mainKeyboard = Markup.inlineKeyboard([
	[Markup.button.callback('👛 My wallets', 'wallets')],
	[Markup.button.callback('🧾 Transactions', 'transactions')],
	[Markup.button.callback('⚙️ Settings', 'settings')],
]);

/**
 * Generate wallets keyboard dynamically
 */
function getWalletsKeyboard(wallets) {
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
	buttons.push([Markup.button.callback('➕ Create wallet', 'create_wallet')]);
	buttons.push([Markup.button.callback('↩ Back to main', 'main')]);
	
	return Markup.inlineKeyboard(buttons);
}

// Keep the static keyboard for backward compatibility or when no wallets exist
const walletsKeyboard = Markup.inlineKeyboard([
	[Markup.button.callback('➕ Create wallet', 'create_wallet')],
	[Markup.button.callback('↩ Back to main', 'main')],
]);

const backToWalletsKeyboard = Markup.inlineKeyboard([
	[Markup.button.callback('↩ Back to wallets', 'wallets')],
	[Markup.button.callback('↩ Back to main', 'main')],
]);

const backToSettingsKeyboard = Markup.inlineKeyboard([
	[Markup.button.callback('↩ Back to settings', 'settings')],
	[Markup.button.callback('↩ Back to main', 'main')],
]);

/**
 * Get back to wallet and wallets keyboard
 */
function getBackToWalletAndWalletsKeyboard(wallet) {
	return Markup.inlineKeyboard([
		[Markup.button.callback(`↩ Back to ${wallet.label}`, `wallet_${wallet.id}`)],
		[Markup.button.callback('↩ Back to wallets', 'wallets')],
		[Markup.button.callback('↩ Back to main', 'main')],
	]);
}


/**
 * Get wallet actions keyboard
 */
function getWalletKeyboard(wallet) {
	return Markup.inlineKeyboard([
		[Markup.button.callback('Deposit', `deposit_${wallet.id}`)],
		[Markup.button.callback('Withdraw', `withdraw_${wallet.id}`)],
		[Markup.button.callback('Transactions', `transactions_${wallet.id}`)],
		[Markup.button.callback('Delete wallet', `delete_wallet_${wallet.id}`)],
		[Markup.button.callback('Change name', `change_label_wallet_${wallet.id}`)],
		[Markup.button.callback('↩ Back to wallets', 'wallets')],
	]);
}

/**
 * Get successful withdrawal keyboard
 */
function getSuccesfullWithdrawKeyboard(transaction, wallet) {
	return Markup.inlineKeyboard([
		[Markup.button.url('See on TronScan', `https://shasta.tronscan.org/#/transaction/${transaction}`)],
		[Markup.button.callback(`↩ Back to ${wallet.label}`, `wallet_${wallet.id}`)],
		[Markup.button.callback('↩ Back to main', 'main')],
	]);
}

// Settings keyboard
const settingsKeyboard = Markup.inlineKeyboard([
	[Markup.button.callback('Change bot language', 'change_language')],
	[Markup.button.callback('↩ Back to main', 'main')],
]);

// Change language keyboard
function getChangeLanguageKeyboard() {
	const buttons = getAvailableLanguages().map(lang => [
		Markup.button.callback(`${lang.flag} ${lang.name}`, `change_language_${lang.code}`),
	]);
	buttons.push([Markup.button.callback('↩ Back to settings', 'settings')]);
	return Markup.inlineKeyboard(buttons);
}

module.exports = { 
	mainKeyboard, 
	walletsKeyboard, 
	getWalletsKeyboard, 
	backToWalletsKeyboard,
	getBackToWalletAndWalletsKeyboard,
	getWalletKeyboard, 
	getSuccesfullWithdrawKeyboard,
	settingsKeyboard,
	getChangeLanguageKeyboard,
	backToSettingsKeyboard,
};

