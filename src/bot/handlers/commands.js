/**
 * Command handlers
 */

const db = require('../../database');
const { mainKeyboard } = require('../keyboards');
const {safeEditOrSend} = require('../../utils/messages');

/**
 * Start command handler
 */
async function handleStart(ctx) {
	const user = ctx.from;
	db.addUser(user);
	
	const userName = user.first_name || 'there';
	await safeEditOrSend(ctx, `Hello ${userName}! Welcome to the bot.`, mainKeyboard);
}

module.exports = { handleStart };

