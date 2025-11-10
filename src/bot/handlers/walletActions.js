/**
 * Wallet action handlers
 */

const db = require('../../database');
const { getBalance, generateWallet, getAllTransactions, formatTransaction } = require('../../services/tron');
const { generateQRCode } = require('../../utils/qrCode');
const { getWalletsKeyboard, getBackToWalletsKeyboard, getWalletKeyboard, getBackToWalletAndWalletsKeyboard, getMainKeyboard } = require('../keyboards');
const { sanitizeLabel } = require('../../utils/sanitize');
const { sunToTRX, validateWalletOwnership, hasSufficientBalance} = require('../../utils/wallet');
const { formatWalletInfo, formatWalletInfoError, formatDepositMessage, formatTransactionHistory, safeEditOrSend, safeDeleteMessage, escapeMarkdown } = require('../../utils/messages');
const { toUserMessage } = require('../../utils/errors');
const logger = require('../../utils/logger');

/**
 * Handle wallets action - show wallet list
 */
async function handleWallets(ctx) {
	await ctx.answerCbQuery();
	const userId = ctx.from.id;
	const wallets = db.getWalletsByUser(userId);
	const keyboard = getWalletsKeyboard(ctx, wallets);
	
	await safeEditOrSend(ctx, ctx.t('wallet.general.choose_wallet'), keyboard);
}

/**
 * Handle main menu action
 */
async function handleMain(ctx) {
	await ctx.answerCbQuery();
	await safeEditOrSend(ctx, ctx.t('ui.main_menu'), getMainKeyboard(ctx));
}

/**
 * Handle create wallet action
 */
async function handleCreateWallet(ctx) {
	await ctx.answerCbQuery();
	await safeEditOrSend(ctx, ctx.t('wallet.create.creating'));
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
			ctx.t('wallet.create.success', { label: result.label, address: result.address }), 
			{ parse_mode: 'Markdown', ...getBackToWalletsKeyboard(ctx)}
		);
	} catch (e) {
		logger.error('Create wallet failed', { error: e });
		await safeEditOrSend(ctx,
			toUserMessage(e, ctx.t('wallet.create.failed')), 
			getBackToWalletsKeyboard(ctx)
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
		await safeEditOrSend(ctx, ctx.t('wallet.general.access_denied'), getBackToWalletsKeyboard(ctx));
		return;
	}
	let message = ctx.t('wallet.general.balance_check_error');
	try {
		const balance = await getBalance(wallet.address);
		const balanceInTRX = sunToTRX(balance);
		message = formatWalletInfo(ctx, wallet, balanceInTRX);
	} catch (e) {
		logger.error('Error getting balance for wallet select', { error: e, walletId });
		message = formatWalletInfoError(ctx, wallet);
	}

	const keyboard = getWalletKeyboard(ctx, wallet);
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
		await safeEditOrSend(ctx, ctx.t('wallet.general.access_denied'), getBackToWalletsKeyboard(ctx));
		return;
	}
	
	try {
		const balance = await getBalance(wallet.address);
		
		if (!hasSufficientBalance(balance)) {
			const balanceInTRX = sunToTRX(balance);
			const keyboard = getBackToWalletAndWalletsKeyboard(ctx, wallet);
			await safeEditOrSend(ctx, ctx.t('wallet.general.balance_insufficient') + '\n\n' + 
			ctx.t('wallet.general.balance_amount', { amount: balanceInTRX }), keyboard);
			return;
		}
		
		// Enter withdrawal scene
		await ctx.scene.enter('withdrawal', { walletId });
	} catch (e) {
		const keyboard = getBackToWalletAndWalletsKeyboard(ctx, wallet);
		logger.error('Error checking balance for withdraw flow', { error: e, walletId });
		await safeEditOrSend(ctx, ctx.t('wallet.general.balance_check_error'), keyboard);
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
		await safeEditOrSend(ctx, ctx.t('wallet.general.access_denied'), getBackToWalletsKeyboard(ctx));
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
		await safeEditOrSend(ctx, ctx.t('wallet.general.access_denied'), getBackToWalletsKeyboard(ctx));
		return;
	}
	
	try {
		await safeEditOrSend(ctx, ctx.t('wallet.transactions.loading'));
		
		const transactions = await getAllTransactions(wallet.address, 10);
		
		if (transactions.length === 0) {
			const keyboard = getBackToWalletAndWalletsKeyboard(ctx, wallet);
			await safeEditOrSend(ctx,
				ctx.t('wallet.transactions.none_found'),
				keyboard
			);
			return;
		}
		
		// Format transactions for display
		const formattedTxs = transactions.map(tx => ({
			...tx,
			formatted: formatTransaction(ctx, tx, wallet.address)
		}));

		const message = formatTransactionHistory(ctx, formattedTxs);
		const keyboard = getBackToWalletAndWalletsKeyboard(ctx, wallet);
		
		await safeEditOrSend(ctx, message, {
			...keyboard,
			parse_mode: 'Markdown'
		});
	} catch (error) {
		logger.error('Error getting transactions', { error, walletId });
		const keyboard = getBackToWalletAndWalletsKeyboard(ctx, wallet);
		await safeEditOrSend(ctx,
			toUserMessage(error, ctx.t('wallet.transactions.error')),
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
		await safeEditOrSend(ctx, ctx.t('wallet.general.access_denied'), getBackToWalletsKeyboard(ctx));
		return;
	}
	
	try {
		const qrBuffer = await generateQRCode(wallet.address);
		const message = formatDepositMessage(ctx, wallet);
		
		safeDeleteMessage(ctx);

		const keyboard = getBackToWalletAndWalletsKeyboard(ctx, wallet);
		
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
		const keyboard = getBackToWalletAndWalletsKeyboard(ctx, wallet);
		const escapedLabel = escapeMarkdown(wallet.label || 'Wallet');
		await safeEditOrSend(ctx,
			ctx.t('wallet.deposit.message', { walletLabel: escapedLabel, address: wallet.address }) + '\n\n' +
				ctx.t('wallet.deposit.qr_error'),
			{ parse_mode: 'Markdown', ...keyboard }
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

