/**
 * Command handlers
 */

const db = require('../../database');
const { getMainKeyboard } = require('../keyboards');
const {safeEditOrSend} = require('../../utils/messages');

/**
 * Start command handler
 */
async function handleStart(ctx) {
	const user = ctx.from;
	db.addUser(user);
	
	const userName = user.first_name || 'there';
	await safeEditOrSend(ctx, ctx.t('commands.start', { userName }), getMainKeyboard(ctx));
}

module.exports = { handleStart };

