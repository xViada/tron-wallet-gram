/**
 * Wallet action handlers
 */

const db = require('../../database');
const { getBalance, generateWallet, generateQRCode, getAllTransactions, formatTransaction } = require('../../services/tron');
const { getWalletsKeyboard, backToWalletsKeyboard, getWalletKeyboard, getBackToWalletAndWalletsKeyboard } = require('../keyboards');
const { sanitizeLabel } = require('../../utils/sanitize');
const { sunToTRX, validateWalletOwnership, hasSufficientBalance} = require('../../utils/wallet');
const { formatWalletInfo, formatWalletInfoError, formatDepositMessage, formatTransactionHistory, safeEditOrSend, safeDeleteMessage } = require('../../utils/messages');
const { toUserMessage } = require('../../utils/errors');
const logger = require('../../utils/logger');

/**
 * Handle wallets action - show wallet list
 */
async function handleWallets(ctx) {
	await ctx.answerCbQuery();
	const userId = ctx.from.id;
	const wallets = db.getWalletsByUser(userId);
	const keyboard = getWalletsKeyboard(wallets);
	
	await safeEditOrSend(ctx, 'Choose a wallet or create a new one:', keyboard);
}

/**
 * Handle main menu action
 */
async function handleMain(ctx) {
	await ctx.answerCbQuery();
	const { mainKeyboard } = require('../keyboards');
	await safeEditOrSend(ctx, 'Main menu:', mainKeyboard);
}

/**
 * Handle create wallet action
 */
async function handleCreateWallet(ctx) {
	await ctx.answerCbQuery();
	await safeEditOrSend(ctx, 'Creating wallet...');
	try {
		const userId = ctx.from.id;
		const account = await generateWallet();
		
		// Derive a default label like "Wallet N+1"
		const existingCount = db.getWalletCountByUser(userId) || 0;
		const defaultLabel = `Wallet ${existingCount + 1}`;
		const safeDefaultLabel = sanitizeLabel(defaultLabel);
		
		// Persist
		const result = db.addWallet({
			userId,
			address: account.address.base58,
			addressHex: account.address.hex,
			privateKey: account.privateKey,
			label: safeDefaultLabel
		});
		
		await safeEditOrSend(ctx,
			`✅ Wallet created successfully!\nLabel: ${result.label}\nAddress: \`${result.address}\``, 
			{ parse_mode: 'Markdown', ...backToWalletsKeyboard}
		);
	} catch (e) {
		logger.error('Create wallet failed', { error: e });
		await safeEditOrSend(ctx,
			toUserMessage(e, '❌ Failed to create wallet. Please try again.'), 
			backToWalletsKeyboard
		);
	}
}

/**
 * Handle wallet selection
 */
async function handleWalletSelect(ctx) {
	await ctx.answerCbQuery();
	const walletId = parseInt(ctx.match[1]);
	const userId = ctx.from.id;
	const wallet = db.getWalletById(walletId);
	
	if (!validateWalletOwnership(wallet, userId) || !wallet) {
		await safeEditOrSend(ctx, '❌ Access denied: Wallet not found or you do not have permission.', backToWalletsKeyboard);
		return;
	}
	let message = 'Error getting balance for wallet select';
	try {
		const balance = await getBalance(wallet.address);
		const balanceInTRX = sunToTRX(balance);
		message = formatWalletInfo(wallet, balanceInTRX);
	} catch (e) {
		logger.error('Error getting balance for wallet select', { error: e, walletId });
		message = formatWalletInfoError(wallet);
	}

	const keyboard = getWalletKeyboard(wallet);
	await safeEditOrSend(ctx, message, { parse_mode: 'Markdown', ...keyboard });
}

/**
 * Handle delete wallet action - enters delete scene
 */
async function handleDeleteWallet(ctx) {
	await ctx.answerCbQuery();
	const walletId = parseInt(ctx.match[1]);
	
	// Enter wallet delete scene
	await ctx.scene.enter('walletDelete', { walletId });
}

/**
 * Handle cancel delete action - handled by scene
 */
async function handleCancelDelete(ctx) {
	// Handled by scene action handler
	await ctx.answerCbQuery();
}

/**
 * Handle withdraw action - enters withdrawal scene
 */
async function handleWithdraw(ctx) {
	await ctx.answerCbQuery();
	const walletId = parseInt(ctx.match[1]);
	const userId = ctx.from.id;
	const wallet = db.getWalletById(walletId);
	
	if (!validateWalletOwnership(wallet, userId)) {
		await safeEditOrSend(ctx, '❌ Access denied: Wallet not found or you do not have permission.', backToWalletsKeyboard);
		return;
	}
	
	try {
		const balance = await getBalance(wallet.address);
		
		if (!hasSufficientBalance(balance)) {
			const balanceInTRX = sunToTRX(balance);
			const keyboard = getBackToWalletAndWalletsKeyboard(wallet);
			await safeEditOrSend(ctx,
				`❌ Insufficient balance. You need at least 2 TRX to withdraw (for transaction fees).\n\n` +
				`Your balance: ${balanceInTRX} TRX`,
				keyboard
			);
			return;
		}
		
		// Enter withdrawal scene
		await ctx.scene.enter('withdrawal', { walletId });
	} catch (e) {
		const keyboard = getBackToWalletAndWalletsKeyboard(wallet);
		logger.error('Error checking balance for withdraw flow', { error: e, walletId });
		await safeEditOrSend(ctx, '❌ Error checking balance. Please try again.', keyboard);
	}
}

/**
 * Handle cancel withdraw action - handled by scene
 */
async function handleCancelWithdraw(ctx) {
	// Handled by scene action handler
	await ctx.answerCbQuery();
}

/**
 * Handle change label action - enters label change scene
 */
async function handleChangeLabel(ctx) {
	await ctx.answerCbQuery();
	const walletId = parseInt(ctx.match[1]);
	const userId = ctx.from.id;
	const wallet = db.getWalletById(walletId);
	
	if (!validateWalletOwnership(wallet, userId)) {
		await safeEditOrSend(ctx, '❌ Access denied: Wallet not found or you do not have permission.', backToWalletsKeyboard);
		return;
	}
	
	// Enter label change scene
	await ctx.scene.enter('labelChange', { walletId });
}

/**
 * Handle cancel label change action - handled by scene
 */
async function handleCancelLabelChange(ctx) {
	// Handled by scene action handler
	await ctx.answerCbQuery();
}

/**
 * Handle transactions action
 */
async function handleTransactions(ctx) {
	await ctx.answerCbQuery();
	const walletId = parseInt(ctx.match[1]);
	const userId = ctx.from.id;
	const wallet = db.getWalletById(walletId);
	
	if (!validateWalletOwnership(wallet, userId)) {
		await safeEditOrSend(ctx, '❌ Access denied: Wallet not found or you do not have permission.', backToWalletsKeyboard);
		return;
	}
	
	try {
		await safeEditOrSend(ctx, '📊 Loading transactions...');
		
		const transactions = await getAllTransactions(wallet.address, 10);
		
		if (transactions.length === 0) {
			const keyboard = getBackToWalletAndWalletsKeyboard(wallet);
			await safeEditOrSend(ctx,
				`📊 Transaction History\n\nNo transactions found for this wallet.`,
				keyboard
			);
			return;
		}
		
		// Format transactions for display
		const formattedTxs = transactions.map(tx => ({
			...tx,
			formatted: formatTransaction(tx, wallet.address)
		}));

		const message = formatTransactionHistory(formattedTxs, wallet.address);
		const keyboard = getBackToWalletAndWalletsKeyboard(wallet);
		
		await safeEditOrSend(ctx, message, {
			...keyboard,
			parse_mode: 'Markdown'
		});
	} catch (error) {
		logger.error('Error getting transactions', { error, walletId });
		const keyboard = getBackToWalletAndWalletsKeyboard(wallet);
		await safeEditOrSend(ctx,
			toUserMessage(error, '❌ Error loading transactions.'),
			keyboard
		);
	}
}

/**
 * Handle deposit action
 */
async function handleDeposit(ctx) {
	await ctx.answerCbQuery();
	const walletId = parseInt(ctx.match[1]);
	const userId = ctx.from.id;
	const wallet = db.getWalletById(walletId);
	
	if (!validateWalletOwnership(wallet, userId)) {
		await safeEditOrSend(ctx, '❌ Access denied: Wallet not found or you do not have permission.', backToWalletsKeyboard);
		return;
	}
	
	try {
		const qrBuffer = await generateQRCode(wallet.address);
		const message = formatDepositMessage(wallet);
		
		safeDeleteMessage(ctx);

		const keyboard = getBackToWalletAndWalletsKeyboard(wallet);
		
		await ctx.replyWithPhoto(
			{ source: qrBuffer },
			{
				caption: message,
				parse_mode: 'Markdown',
				...keyboard
			}
		);
	} catch (error) {
		logger.error('Error generating QR code', { error, walletId });
		const keyboard = getBackToWalletAndWalletsKeyboard(wallet);
		await safeEditOrSend(ctx,
			`💰 Deposit to ${wallet.label || 'Wallet'}\n\n` +
			`Address: \`${wallet.address}\`\n\n` +
			`❌ Error generating QR code. Please use the address above.`,
			keyboard
		);
	}
}

module.exports = {
	handleWallets,
	handleMain,
	handleCreateWallet,
	handleWalletSelect,
	handleDeleteWallet,
	handleCancelDelete,
	handleWithdraw,
	handleCancelWithdraw,
	handleChangeLabel,
	handleCancelLabelChange,
	handleTransactions,
	handleDeposit,
};

