/**
 * Label change scene - handles wallet label change
 */

const { Scenes } = require('telegraf');
const db = require('../../database');
const { getBackToWalletsKeyboard } = require('../keyboards');
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
			[Markup.button.callback(ctx.t('buttons.cancel'), `cancel_change_label_${wallet.id}`)]
		]);
		
		const currentLabel = wallet.label || 'Unnamed Wallet';
		await safeEditOrSend(ctx,
			ctx.t('wallet.label.title') + '\n\n' +
			ctx.t('wallet.label.current_name', { name: currentLabel }) + '\n\n' +
			ctx.t('wallet.label.enter_new_name'),
			cancelKeyboard
		);
		return; // Don't reinitialize
	}
	
	// Normal entry - initialize from scratch
	const wallet = db.getWalletById(walletId);
	
	if (!validateWalletOwnership(wallet, userId)) {
		await safeEditOrSend(ctx, ctx.t('wallet.general.access_denied'), getBackToWalletsKeyboard(ctx));
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
		[Markup.button.callback(ctx.t('buttons.cancel'), `cancel_change_label_${walletId}`)]
	]);
	
	const currentLabel = wallet.label || 'Unnamed Wallet';
	await safeEditOrSend(ctx,
		ctx.t('wallet.label.title') + '\n\n' +
		ctx.t('wallet.label.current_name', { name: currentLabel }) + '\n\n' +
		ctx.t('wallet.label.enter_new_name'),
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
		[Markup.button.callback(ctx.t('buttons.cancel'), `cancel_change_label_${walletId}`)]
	]);
	
	if (!rawLabel || rawLabel.length === 0) {
		return await safeEditOrSend(ctx, ctx.t('wallet.label.empty_error'), cancelKeyboard);
	}
	
	if (rawLabel.length > 20) {
		return await safeEditOrSend(ctx, ctx.t('wallet.label.too_long_error'), cancelKeyboard);
	}
	
	const newLabel = sanitizeLabel(rawLabel);
	
	// Update the wallet label
	try {
		const success = db.updateWalletLabel(wallet.id, newLabel);
		
		if (success) {
			// Clear pending state
			db.clearPendingState(userId, 'label');
			
			await safeEditOrSend(ctx,
				ctx.t('wallet.label.success') + '\n\n' +
				ctx.t('wallet.label.new_name', { name: newLabel }),
				getBackToWalletsKeyboard(ctx)
			);
			
			ctx.scene.leave();
		} else {
			throw new Error(ctx.t('wallet.label.failed'));
		}
	} catch (error) {
		logger.error('Label update error', { error, walletId: wallet.id });
		db.clearPendingState(userId, 'label');
		await safeEditOrSend(ctx,
			toUserMessage(error, ctx.t('wallet.label.failed')),
			getBackToWalletsKeyboard(ctx)
		);
		ctx.scene.leave();
	}
});

// Handle cancel action
labelChangeScene.action(/^cancel_change_label_(\d+)$/, async (ctx) => {
	await ctx.answerCbQuery();
	const userId = ctx.from.id;
	db.clearPendingState(userId, 'label');
	await safeEditOrSend(ctx, ctx.t('wallet.label.cancelled'), getBackToWalletsKeyboard(ctx));
	ctx.scene.leave();
});

module.exports = { labelChangeScene };

