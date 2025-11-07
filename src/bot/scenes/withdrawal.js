/**
 * Withdrawal scene - handles multi-step withdrawal flow
 */

const { Scenes } = require('telegraf');
const db = require('../../database');
const { sendTransaction, isValidTronAddress } = require('../../services/tron');
const { getBalance } = require('../../services/tron');
const { backToWalletsKeyboard, getSuccesfullWithdrawKeyboard } = require('../keyboards');
const { sunToTRX, getMaxWithdrawable, validateWalletOwnership } = require('../../utils/wallet');
const { safeEditOrSend, formatWithdrawalSuccess } = require('../../utils/messages');
const { toUserMessage } = require('../../utils/errors');
const logger = require('../../utils/logger');
const { Markup } = require('telegraf');

// Scene step constants
const STEP_ADDRESS = 'ADDRESS';
const STEP_AMOUNT = 'AMOUNT';

// Create withdrawal scene
const withdrawalScene = new Scenes.BaseScene('withdrawal');

// Store scene data in session
withdrawalScene.enter(async (ctx) => {
	const walletId = ctx.scene.state.walletId;
	const userId = ctx.from.id;
	
	// Check if scene is being restored (state already has wallet and step)
	// If so, skip initialization and show appropriate message
	if (ctx.scene.state.wallet && ctx.scene.state.step && ctx.scene.state.walletId) {
		const wallet = ctx.scene.state.wallet;
		const step = ctx.scene.state.step;
		const cancelKeyboard = Markup.inlineKeyboard([
			[Markup.button.callback('❌ Cancel', `cancel_withdraw_${wallet.id}`)]
		]);
		
		if (step === STEP_ADDRESS) {
			// Restored at address step
			await safeEditOrSend(ctx,
				`💸 Withdraw from: ${wallet.label || 'Wallet'}\n\n` +
				`Available balance: ${ctx.scene.state.balanceInTRX} TRX\n\n` +
				`Please send me the destination Tron address (starting with T):`,
				cancelKeyboard
			);
		} else if (step === STEP_AMOUNT && ctx.scene.state.toAddress) {
			// Restored at amount step
			await safeEditOrSend(ctx,
				`✅ Address received: \`${ctx.scene.state.toAddress}\`\n\n` +
				`Available balance: ${ctx.scene.state.balanceInTRX} TRX\n\n` +
				`How much TRX do you want to withdraw? (Enter amount in TRX, e.g., 1.5 or 10):`,
				{ parse_mode: 'Markdown', ...cancelKeyboard }
			);
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
		const balance = await getBalance(wallet.address);
		const balanceInTRX = sunToTRX(balance);
		
		// Store wallet data in scene state
		ctx.scene.state.wallet = wallet;
		ctx.scene.state.balanceInTRX = balanceInTRX;
		ctx.scene.state.step = STEP_ADDRESS;
		
		// Persist to DB
		db.setPendingState(userId, 'withdrawal', {
			walletId: walletId,
			step: STEP_ADDRESS,
			wallet: wallet,
			balanceInTRX: balanceInTRX
		});
		
		const cancelKeyboard = Markup.inlineKeyboard([
			[Markup.button.callback('❌ Cancel', `cancel_withdraw_${walletId}`)]
		]);
		
		await safeEditOrSend(ctx,
			`💸 Withdraw from: ${wallet.label || 'Wallet'}\n\n` +
			`Available balance: ${balanceInTRX} TRX\n\n` +
			`Please send me the destination Tron address (starting with T):`,
			cancelKeyboard
		);
	} catch (e) {
		logger.error('Error checking balance for withdraw flow', { error: e, walletId });
		await safeEditOrSend(ctx, '❌ Error checking balance. Please try again.', backToWalletsKeyboard);
		ctx.scene.leave();
	}
});

// Handle address input
withdrawalScene.on('text', async (ctx) => {
	const wallet = ctx.scene.state.wallet;
	const step = ctx.scene.state.step;
	const userId = ctx.from.id;
	
	const cancelKeyboard = Markup.inlineKeyboard([
		[Markup.button.callback('❌ Cancel', `cancel_withdraw_${wallet.id}`)]
	]);
	
	if (step === STEP_ADDRESS) {
		// Validate address
		if (!isValidTronAddress(ctx.message.text)) {
			return await safeEditOrSend(ctx, '❌ Invalid Tron address. Please send a valid address (starting with T):', cancelKeyboard);
		}
		
		const destinationAddress = ctx.message.text.trim();
		
		// Check if user is trying to send to the same wallet
		if (destinationAddress.toLowerCase() === wallet.address.toLowerCase()) {
			return await safeEditOrSend(ctx,
				'❌ You cannot send to the same wallet address.\n\n' +
				'Please send a different destination address:',
				cancelKeyboard
			);
		}
		
		// Store destination address and move to amount step
		ctx.scene.state.toAddress = destinationAddress;
		ctx.scene.state.step = STEP_AMOUNT;
		
		// Persist to DB
		db.setPendingState(userId, 'withdrawal', {
			walletId: wallet.id,
			step: STEP_AMOUNT,
			wallet: wallet,
			balanceInTRX: ctx.scene.state.balanceInTRX,
			toAddress: destinationAddress
		});
		
		await safeEditOrSend(ctx,
			`✅ Address received: \`${destinationAddress}\`\n\n` +
			`Available balance: ${ctx.scene.state.balanceInTRX} TRX\n\n` +
			`How much TRX do you want to withdraw? (Enter amount in TRX, e.g., 1.5 or 10):`,
			{ parse_mode: 'Markdown', ...cancelKeyboard }
		);
		
	} else if (step === STEP_AMOUNT) {
		// Parse and validate amount
		const amount = parseFloat(ctx.message.text);
		
		if (isNaN(amount) || amount <= 0) {
			return await safeEditOrSend(ctx, '❌ Invalid amount. Please enter a valid number (e.g., 1.5 or 10):', cancelKeyboard);
		}
		
		// Check if amount is less than or equal to available balance (with fee buffer)
		const maxWithdrawable = getMaxWithdrawable(ctx.scene.state.balanceInTRX);
		
		if (amount > maxWithdrawable) {
			return await safeEditOrSend(ctx,
				`❌ Insufficient balance. Maximum withdrawable amount: ${maxWithdrawable} TRX\n\n` +
				`(Need to keep 2 TRX for transaction fees)`,
				cancelKeyboard
			);
		}
		
		// Confirm and execute withdrawal
		try {
			await safeEditOrSend(ctx, '⏳ Processing withdrawal...');
			
			const result = await sendTransaction(
				wallet.private_key,
				ctx.scene.state.toAddress,
				amount
			);
			
			if (result.result) {
				const txHash = result.txid;
				const keyboard = getSuccesfullWithdrawKeyboard(txHash, wallet);
				
				// Clear pending state
				db.clearPendingState(userId, 'withdrawal');
				
				// Edit the processing message we just sent
				await safeEditOrSend(ctx, formatWithdrawalSuccess(amount, ctx.scene.state.toAddress, txHash));
				
				// Leave scene
				ctx.scene.leave();
			} else {
				throw new Error(result.message || 'Transaction failed');
			}
		} catch (error) {
			logger.error('Withdrawal error', { error, walletId: wallet.id });
			db.clearPendingState(userId, 'withdrawal');
			await safeEditOrSend(ctx,
				toUserMessage(error, '❌ Withdrawal failed. Please try again.'),
				backToWalletsKeyboard
			);
			ctx.scene.leave();
		}
	}
});

// Handle cancel action
withdrawalScene.action(/^cancel_withdraw_(\d+)$/, async (ctx) => {
	await ctx.answerCbQuery();
	const userId = ctx.from.id;
	db.clearPendingState(userId, 'withdrawal');
	await safeEditOrSend(ctx, '❌ Withdrawal cancelled.', backToWalletsKeyboard);
	ctx.scene.leave();
});

module.exports = { withdrawalScene };

