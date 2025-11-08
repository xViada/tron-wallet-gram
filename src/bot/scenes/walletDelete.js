/**
 * Wallet delete scene - handles wallet deletion confirmation
 */

const { Scenes } = require('telegraf');
const db = require('../../database');
const { getBalance } = require('../../services/tron');
const { getBackToWalletsKeyboard } = require('../keyboards');
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
			[Markup.button.callback(ctx.t('buttons.cancel'), `cancel_delete_${wallet.id}`)]
		]);
		
		try {
			// Get fresh balance for confirmation message
			const balance = await getBalance(wallet.address);
			const balanceInTRX = sunToTRX(balance);
			
			await safeEditOrSend(ctx,
				ctx.t('wallet.delete.confirm_title') + '\n\n' +
				ctx.t('wallet.delete.name', { name: wallet.label || 'Unnamed Wallet' }) + '\n\n' +
				ctx.t('wallet.delete.balance', { balance: balanceInTRX }) + '\n\n' +
				ctx.t('wallet.delete.irreversible') + '\n\n' +
				ctx.t('wallet.delete.confirm_prompt', { walletLabel: wallet.label || 'Unnamed Wallet' }),
				cancelKeyboard
			);
		} catch (e) {
			logger.error('Error getting balance for delete flow (restored)', { error: e, walletId });
			await safeEditOrSend(ctx, ctx.t('wallet.delete.balance_error'), getBackToWalletsKeyboard(ctx));
			ctx.scene.leave();
		}
		return; // Don't reinitialize
	}
	
	// Normal entry - initialize from scratch
	const wallet = db.getWalletById(walletId);
	
	if (!validateWalletOwnership(wallet, userId)) {
		await safeEditOrSend(ctx, ctx.t('wallet.general.access_denied'), getBackToWalletsKeyboard(ctx));
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
			[Markup.button.callback(ctx.t('buttons.cancel'), `cancel_delete_${walletId}`)]
		]);
		
		await safeEditOrSend(ctx,
			ctx.t('wallet.delete.confirm_title') + '\n\n' +
			ctx.t('wallet.delete.name', { name: wallet.label || 'Unnamed Wallet' }) + '\n\n' +
			ctx.t('wallet.delete.balance', { balance: balanceInTRX }) + '\n\n' +
			ctx.t('wallet.delete.irreversible') + '\n\n' +
			ctx.t('wallet.delete.confirm_prompt', { walletLabel: wallet.label || 'Unnamed Wallet' }),
			cancelKeyboard
		);
	} catch (e) {
		logger.error('Error getting balance for delete flow', { error: e, walletId });
		await safeEditOrSend(ctx, ctx.t('wallet.delete.balance_error'), getBackToWalletsKeyboard(ctx));
		ctx.scene.leave();
	}
});

// Handle confirmation input
walletDeleteScene.on('text', async (ctx) => {
	const wallet = ctx.scene.state.wallet;
	const confirmation = ctx.message.text.trim().toLowerCase();
	const userId = ctx.from.id;
	
	if (confirmation === wallet.label.toLowerCase()) {
		try {
			const success = db.deleteWallet(wallet.id);
			
			if (success) {
				// Clear pending state
				db.clearPendingState(userId, 'delete');
				await safeEditOrSend(ctx,
					ctx.t('wallet.delete.success', { walletLabel: wallet.label || 'Unnamed Wallet' }),
					getBackToWalletsKeyboard(ctx)
				);
				ctx.scene.leave();
			} else {
				throw new Error(ctx.t('wallet.delete.failed'));
			}
		} catch (error) {
			logger.error('Delete wallet error', { error, walletId: wallet.id });
			db.clearPendingState(userId, 'delete');
			await safeEditOrSend(ctx,
				toUserMessage(error, ctx.t('wallet.delete.failed')),
				getBackToWalletsKeyboard(ctx)
			);
			ctx.scene.leave();
		}
	} else {
		// Clear pending state
		db.clearPendingState(userId, 'delete');
		await safeEditOrSend(ctx,
			ctx.t('wallet.delete.cancelled', { walletLabel: wallet.label || 'Unnamed Wallet' }),
			getBackToWalletsKeyboard(ctx)
		);
		ctx.scene.leave();
	}
});

// Handle cancel action
walletDeleteScene.action(/^cancel_delete_(\d+)$/, async (ctx) => {
	await ctx.answerCbQuery();
	const userId = ctx.from.id;
	db.clearPendingState(userId, 'delete');
	await safeEditOrSend(ctx, ctx.t('wallet.delete.cancel_action'), getBackToWalletsKeyboard(ctx));
	ctx.scene.leave();
});

module.exports = { walletDeleteScene };

