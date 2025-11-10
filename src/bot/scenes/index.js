/**
 * Scenes module - exports all scenes
 */

const { withdrawalScene } = require('./withdrawal');
const { labelChangeScene } = require('./labelChange');
const { walletDeleteScene } = require('./walletDelete');
const { enableTwoFactorAuthScene } = require('./enableTwoFactorAuth');
const { disableTwoFactorAuthScene } = require('./disableTwoFactorAuth');

module.exports = {
	withdrawalScene,
	labelChangeScene,
	walletDeleteScene,
	enableTwoFactorAuthScene,
	disableTwoFactorAuthScene,
};

