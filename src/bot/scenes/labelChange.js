/**
 * Label change scene - handles wallet label change
 */

const { Scenes } = require('telegraf');
const db = require('../../database');
const { backToWalletsKeyboard } = require('../keyboards');
const { safeEditOrSend } = require('../../utils/messages');
const { sanitizeLabel } = require('../../utils/sanitize');
const { validateWalletOwnership } = require('../../utils/wallet');
const { toUserMessage } = require('../../utils/errors');
const logger = require('../../utils/logger');
const { Markup } = require('telegraf');

// Create label change scene
const labelChangeScene = new Scenes.BaseScene('labelChange');

// Enter scene
labelChangeScene.enter(async (ctx) => {
	const walletId = ctx.scene.state.walletId;
	const userId = ctx.from.id;
	
	// Check if scene is being restored (state already has wallet)
	if (ctx.scene.state.wallet && ctx.scene.state.walletId) {
		const wallet = ctx.scene.state.wallet;
		const cancelKeyboard = Markup.inlineKeyboard([
			[Markup.button.callback('❌ Cancel', `cancel_change_label_${wallet.id}`)]
		]);
		
		const currentLabel = wallet.label || 'Unnamed Wallet';
		await safeEditOrSend(ctx,
			`✏️ Change wallet name\n\n` +
			`Current name: ${currentLabel}\n\n` +
			`Please send me the new name for this wallet:`,
			cancelKeyboard
		);
		return; // Don't reinitialize
	}
	
	// Normal entry - initialize from scratch
	const wallet = db.getWalletById(walletId);
	
	if (!validateWalletOwnership(wallet, userId)) {
		await safeEditOrSend(ctx, '❌ Access denied: Wallet not found or you do not have permission.', backToWalletsKeyboard);
		return ctx.scene.leave();
	}
	
	// Store wallet in scene state
	ctx.scene.state.wallet = wallet;
	
	// Persist to DB
	db.setPendingState(userId, 'label', {
		walletId: walletId,
		wallet: wallet
	});
	
	const cancelKeyboard = Markup.inlineKeyboard([
		[Markup.button.callback('❌ Cancel', `cancel_change_label_${walletId}`)]
	]);
	
	const currentLabel = wallet.label || 'Unnamed Wallet';
	await safeEditOrSend(ctx,
		`✏️ Change wallet name\n\n` +
		`Current name: ${currentLabel}\n\n` +
		`Please send me the new name for this wallet:`,
		cancelKeyboard
	);
});

// Handle label input
labelChangeScene.on('text', async (ctx) => {
	const walletId = ctx.scene.state.walletId;
	const wallet = ctx.scene.state.wallet;
	const userId = ctx.from.id;
	
	// Validate label (trim whitespace, check length) on raw input first
	const rawLabel = ctx.message.text.trim();

	const cancelKeyboard = Markup.inlineKeyboard([
		[Markup.button.callback('❌ Cancel', `cancel_change_label_${walletId}`)]
	]);
	
	if (!rawLabel || rawLabel.length === 0) {
		return await safeEditOrSend(ctx, '❌ Label cannot be empty. Please send a valid name:', cancelKeyboard);
	}
	
	if (rawLabel.length > 20) {
		return await safeEditOrSend(ctx, '❌ Label is too long. Maximum 20 characters. Please send a shorter name:', cancelKeyboard);
	}
	
	const newLabel = sanitizeLabel(rawLabel);
	
	// Update the wallet label
	try {
		const success = db.updateWalletLabel(wallet.id, newLabel);
		
		if (success) {
			// Clear pending state
			db.clearPendingState(userId, 'label');
			
			await safeEditOrSend(ctx,
				`✅ Wallet name updated successfully!\n\n` +
				`New name: ${newLabel}`,
				backToWalletsKeyboard
			);
			
			ctx.scene.leave();
		} else {
			throw new Error('Failed to update label');
		}
	} catch (error) {
		logger.error('Label update error', { error, walletId: wallet.id });
		db.clearPendingState(userId, 'label');
		await safeEditOrSend(ctx,
			toUserMessage(error, '❌ Failed to update wallet name. Please try again.'),
			backToWalletsKeyboard
		);
		ctx.scene.leave();
	}
});

// Handle cancel action
labelChangeScene.action(/^cancel_change_label_(\d+)$/, async (ctx) => {
	await ctx.answerCbQuery();
	const userId = ctx.from.id;
	db.clearPendingState(userId, 'label');
	await safeEditOrSend(ctx, '❌ Label change cancelled.', backToWalletsKeyboard);
	ctx.scene.leave();
});

module.exports = { labelChangeScene };

