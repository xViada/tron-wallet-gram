/**
 * Telegram bot initialization and setup
 */

const { Telegraf, Scenes, session } = require('telegraf');
const { getConfig } = require('../config');
const logger = require('../utils/logger');
const { rateLimit } = require('./middlewares/rateLimit');
const { createSessionStore } = require('./middlewares/sessionStore');
const { sceneRestorationMiddleware } = require('./middlewares/scenePersistence');
const { handleStart } = require('./handlers/commands');
const {
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
} = require('./handlers/walletActions');
const { handleSettings, handleChangeLanguage, handleLanguageSelection } = require('./handlers/settingsActions');
const { withdrawalScene, labelChangeScene, walletDeleteScene } = require('./scenes');

/**
 * Initialize and configure the bot
 */
function createBot() {
	const config = getConfig();
	
	if (!config.botToken) {
		logger.error('Startup error: BOT_TOKEN missing');
		process.exit(1);
	}
	
	const bot = new Telegraf(config.botToken);
	
	// Create stage for scenes
	const stage = new Scenes.Stage([
		withdrawalScene,
		labelChangeScene,
		walletDeleteScene,
	]);
	
	// Create database-backed session store
	const sessionStore = createSessionStore();
	
	// Register session middleware FIRST (required for scenes)
	// Use database-backed session store for persistence
	bot.use(session({ store: sessionStore }));
	
	// Register stage middleware (must be after session)
	bot.use(stage.middleware());
	
	// Register scene restoration middleware (must be after session and stage)
	// This restores scenes from pending states after bot restart
	// Must run after stage so ctx.scene is available
	bot.use(sceneRestorationMiddleware());
	
	// Install rate limiting middleware
	bot.use(rateLimit({
		windowMs: 10000, // 10s window
		max: 8,          // 8 updates per 10s per user
		blockMs: 15000   // 15s temporary block
	}));
	
	// Register command handlers
	bot.start(handleStart);
	
	// Register action handlers
	bot.action('wallets', handleWallets);
	bot.action('main', handleMain);
	bot.action('create_wallet', handleCreateWallet);
	bot.action(/^wallet_(\d+)$/, handleWalletSelect);
	bot.action(/^delete_wallet_(\d+)$/, handleDeleteWallet);
	bot.action(/^cancel_delete_(\d+)$/, handleCancelDelete);
	bot.action(/^withdraw_(\d+)$/, handleWithdraw);
	bot.action(/^cancel_withdraw_(\d+)$/, handleCancelWithdraw);
	bot.action(/^change_label_wallet_(\d+)$/, handleChangeLabel);
	bot.action(/^cancel_change_label_(\d+)$/, handleCancelLabelChange);
	bot.action(/^transactions_(\d+)$/, handleTransactions);
	bot.action(/^deposit_(\d+)$/, handleDeposit);
	bot.action('settings', handleSettings);
	bot.action('change_language', handleChangeLanguage);
	bot.action(/^change_language_(\w+)$/, handleLanguageSelection);
	return bot;
}

module.exports = { createBot };

