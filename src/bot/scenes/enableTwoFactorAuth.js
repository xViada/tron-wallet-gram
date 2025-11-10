const { Scenes } = require('telegraf');
const db = require('../../database');
const { generateTwoFactorAuth, verifyTwoFactorAuthToken } = require('../../services/twoFactorAuth');
const { getBackToSettingsKeyboard, getEnableTwoFactorAuthKeyboard } = require('../keyboards');
const { safeEditOrSend } = require('../../utils/messages');
const logger = require('../../utils/logger');
const { Markup } = require('telegraf');

// Scene step constants
const STEP_QR_CODE = 'QR_CODE';
const STEP_VERIFY_CODE = 'VERIFY_CODE';

// Create enable two factor auth scene
const enableTwoFactorAuthScene = new Scenes.BaseScene('enableTwoFactorAuth');

// Enter scene
enableTwoFactorAuthScene.enter(async (ctx) => {
    await ctx.answerCbQuery();
    try {
        const { secret, qrCode } = await generateTwoFactorAuth();
        const qrCodeBuffer = Buffer.from(qrCode, 'base64');
        db.updateUserTwoFactorAuthSecret(ctx.from.id, secret.base32);
        
        // Store secret in scene state for verification
        ctx.scene.state.secret = secret.base32;
        ctx.scene.state.step = STEP_QR_CODE;
        
        const keyboard = getEnableTwoFactorAuthKeyboard(ctx);
        await ctx.replyWithPhoto({ source: qrCodeBuffer },
            {
                caption: ctx.t('settings.two_factor_auth.enable_message_first_step', { secret: secret.base32 }),
                parse_mode: 'Markdown',
                ...keyboard
            });
    } catch (error) {
        logger.error('Error generating 2FA QR code', { error, userId: ctx.from.id });
        await safeEditOrSend(ctx, ctx.t('settings.two_factor_auth.verification_error'), getBackToSettingsKeyboard(ctx));
        ctx.scene.leave();
    }
});

// Handle next step action
enableTwoFactorAuthScene.action('2fa_enable_next_step', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.state.step = STEP_VERIFY_CODE;
    
    const cancelKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback(ctx.t('buttons.cancel'), '2fa_enable_cancel')]
    ]);
    
    await safeEditOrSend(ctx, ctx.t('settings.two_factor_auth.enable_message_second_step'), cancelKeyboard);
});

// Handle cancel action
enableTwoFactorAuthScene.action('2fa_enable_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    // Clear the secret if user cancels
    db.updateUserTwoFactorAuthSecret(ctx.from.id, null);
    await safeEditOrSend(ctx, ctx.t('settings.two_factor_auth.enable_cancelled'), getBackToSettingsKeyboard(ctx));
    ctx.scene.leave();
});

// Handle text input for verification code
enableTwoFactorAuthScene.on('text', async (ctx) => {
    const step = ctx.scene.state.step;
    const userId = ctx.from.id;
    
    if (step !== STEP_VERIFY_CODE) {
        return; // Ignore text if not in verification step
    }
    
    const token = ctx.message.text.trim();
    const secret = ctx.scene.state.secret || db.getUserTwoFactorAuthSecret(userId);
    
    if (!secret) {
        logger.error('2FA verification failed: no secret found', { userId });
        await safeEditOrSend(ctx, ctx.t('settings.two_factor_auth.verification_error'), getBackToSettingsKeyboard(ctx));
        ctx.scene.leave();
        return;
    }
    
    // Validate token format (should be 6 digits)
    if (!/^\d{6}$/.test(token)) {
        const cancelKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback(ctx.t('buttons.cancel'), '2fa_enable_cancel')]
        ]);
        return await safeEditOrSend(ctx, ctx.t('settings.two_factor_auth.invalid_code_format'), cancelKeyboard);
    }
    
    // Verify the token
    const isValid = verifyTwoFactorAuthToken(secret, token);
    
    if (isValid) {
        // Enable 2FA for the user
        db.updateUserTwoFactorAuthEnabled(userId, true);
        await safeEditOrSend(ctx, ctx.t('settings.two_factor_auth.enable_success'), getBackToSettingsKeyboard(ctx));
        ctx.scene.leave();
    } else {
        // Invalid token, ask to try again
        const cancelKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback(ctx.t('buttons.cancel'), '2fa_enable_cancel')]
        ]);
        await safeEditOrSend(ctx, ctx.t('settings.two_factor_auth.invalid_code'), cancelKeyboard);
    }
});

module.exports = { enableTwoFactorAuthScene };