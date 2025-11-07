/**
 * Wallet delete scene - handles wallet deletion confirmation
 */

const { Scenes } = require('telegraf');
const db = require('../../database');
const { getBalance } = require('../../services/tron');
const { backToWalletsKeyboard } = require('../keyboards');
const { safeEditOrSend } = require('../../utils/messages');
const { sunToTRX, validateWalletOwnership } = require('../../utils/wallet');
const { toUserMessage } = require('../../utils/errors');
const logger = require('../../utils/logger');
const { Markup } = require('telegraf');

// Create wallet delete scene
const walletDeleteScene = new Scenes.BaseScene('walletDelete');

// Enter scene
walletDeleteScene.enter(async (ctx) => {
	const walletId = ctx.scene.state.walletId;
	const userId = ctx.from.id;
	
	// Check if scene is being restored (state already has wallet)
	if (ctx.scene.state.wallet && ctx.scene.state.walletId) {
		const wallet = ctx.scene.state.wallet;
		const cancelKeyboard = Markup.inlineKeyboard([
			[Markup.button.callback('❌ Cancel', `cancel_delete_${wallet.id}`)]
		]);
		
		try {
			// Get fresh balance for confirmation message
			const balance = await getBalance(wallet.address);
			const balanceInTRX = sunToTRX(balance);
			
			await safeEditOrSend(ctx,
				`⚠️ Are you sure you want to delete this wallet?\n\n` +
				`Name: ${wallet.label || 'Unnamed Wallet'}\n` +
				`Balance: ${balanceInTRX} TRX\n\n` +
				`⚠️ This action cannot be undone!\n\n` +
				`If you are sure, type "Yes" to confirm:`,
				cancelKeyboard
			);
		} catch (e) {
			logger.error('Error getting balance for delete flow (restored)', { error: e, walletId });
			await safeEditOrSend(ctx, '❌ Error checking balance. Please try again.', backToWalletsKeyboard);
			ctx.scene.leave();
		}
		return; // Don't reinitialize
	}
	
	// Normal entry - initialize from scratch
	const wallet = db.getWalletById(walletId);
	
	if (!validateWalletOwnership(wallet, userId)) {
		await safeEditOrSend(ctx, '❌ Access denied: Wallet not found or you do not have permission.', backToWalletsKeyboard);
		return ctx.scene.leave();
	}
	
	try {
		// Get balance for confirmation message
		const balance = await getBalance(wallet.address);
		const balanceInTRX = sunToTRX(balance);
		
		// Store wallet in scene state
		ctx.scene.state.wallet = wallet;
		
		// Persist to DB
		db.setPendingState(userId, 'delete', {
			walletId: walletId,
			wallet: wallet
		});
		
		const cancelKeyboard = Markup.inlineKeyboard([
			[Markup.button.callback('❌ Cancel', `cancel_delete_${walletId}`)]
		]);
		
		await safeEditOrSend(ctx,
			`⚠️ Are you sure you want to delete this wallet?\n\n` +
			`Name: ${wallet.label || 'Unnamed Wallet'}\n` +
			`Balance: ${balanceInTRX} TRX\n\n` +
			`⚠️ This action cannot be undone!\n\n` +
			`If you are sure, type "Yes" to confirm:`,
			cancelKeyboard
		);
	} catch (e) {
		logger.error('Error getting balance for delete flow', { error: e, walletId });
		await safeEditOrSend(ctx, '❌ Error checking balance. Please try again.', backToWalletsKeyboard);
		ctx.scene.leave();
	}
});

// Handle confirmation input
walletDeleteScene.on('text', async (ctx) => {
	const wallet = ctx.scene.state.wallet;
	const confirmation = ctx.message.text.trim();
	const userId = ctx.from.id;
	
	if (confirmation === 'Yes' || confirmation === 'yes') {
		try {
			const success = db.deleteWallet(wallet.id);
			
			if (success) {
				// Clear pending state
				db.clearPendingState(userId, 'delete');
				await safeEditOrSend(ctx,
					`✅ Wallet "${wallet.label || 'Unnamed Wallet'}" was successfully deleted.`,
					backToWalletsKeyboard
				);
				ctx.scene.leave();
			} else {
				throw new Error('Failed to delete wallet');
			}
		} catch (error) {
			logger.error('Delete wallet error', { error, walletId: wallet.id });
			db.clearPendingState(userId, 'delete');
			await safeEditOrSend(ctx,
				toUserMessage(error, '❌ Failed to delete wallet. Please try again.'),
				backToWalletsKeyboard
			);
			ctx.scene.leave();
		}
	} else {
		// Clear pending state
		db.clearPendingState(userId, 'delete');
		await safeEditOrSend(ctx,
			`❌ Wallet deletion cancelled. You didn't type "Yes".`,
			backToWalletsKeyboard
		);
		ctx.scene.leave();
	}
});

// Handle cancel action
walletDeleteScene.action(/^cancel_delete_(\d+)$/, async (ctx) => {
	await ctx.answerCbQuery();
	const userId = ctx.from.id;
	db.clearPendingState(userId, 'delete');
	await safeEditOrSend(ctx, '❌ Delete cancelled.', backToWalletsKeyboard);
	ctx.scene.leave();
});

module.exports = { walletDeleteScene };

