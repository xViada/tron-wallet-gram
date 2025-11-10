const { Scenes } = require('telegraf');
const db = require('../../database');
const { verifyTwoFactorAuthToken } = require('../../services/twoFactorAuth');
const { getBackToSettingsKeyboard, getDisableTwoFactorAuthKeyboard } = require('../keyboards');
const { safeEditOrSend } = require('../../utils/messages');

// Create disable two factor auth scene
const disableTwoFactorAuthScene = new Scenes.BaseScene('disableTwoFactorAuth');

// Enter scene
disableTwoFactorAuthScene.enter(async (ctx) => {
    await ctx.answerCbQuery();
    const keyboard = getDisableTwoFactorAuthKeyboard(ctx);
    await safeEditOrSend(ctx, ctx.t('settings.two_factor_auth.disable_message'), keyboard);
});

// Handle disable verification input
disableTwoFactorAuthScene.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const code = ctx.message.text.trim();
    
    // Validate token format (should be 6 digits)
    if (!/^\d{6}$/.test(code)) {
        return await safeEditOrSend(ctx, ctx.t('settings.two_factor_auth.invalid_code_format'), getDisableTwoFactorAuthKeyboard(ctx));
    }
    
    const secret = db.getUserTwoFactorAuthSecret(userId);
    if (!secret) {
        await safeEditOrSend(ctx, ctx.t('settings.two_factor_auth.verification_error'), getBackToSettingsKeyboard(ctx));
        ctx.scene.leave();
        return;
    }
    
    const verification = verifyTwoFactorAuthToken(secret, code);
    if (!verification) {
        await safeEditOrSend(ctx, ctx.t('settings.two_factor_auth.invalid_code'), getDisableTwoFactorAuthKeyboard(ctx));
        return;
    }
    
    // Disable 2FA and clear the secret
    const success = db.updateUserTwoFactorAuthEnabled(userId, false);
    if (success) {
        // Clear the secret for security
        db.updateUserTwoFactorAuthSecret(userId, null);
        await safeEditOrSend(ctx, ctx.t('settings.two_factor_auth.disable_success'), getBackToSettingsKeyboard(ctx));
    } else {
        await safeEditOrSend(ctx, ctx.t('settings.two_factor_auth.disable_error'), getBackToSettingsKeyboard(ctx));
    }
    ctx.scene.leave();
});

// Handle cancel action
disableTwoFactorAuthScene.action('2fa_disable_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    await safeEditOrSend(ctx, ctx.t('settings.two_factor_auth.disable_cancelled'), getBackToSettingsKeyboard(ctx));
    ctx.scene.leave();
});

module.exports = { disableTwoFactorAuthScene };

