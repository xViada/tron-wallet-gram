/**
 * Scenes module - exports all scenes
 */

const { withdrawalScene } = require('./withdrawal');
const { labelChangeScene } = require('./labelChange');
const { walletDeleteScene } = require('./walletDelete');

module.exports = {
	withdrawalScene,
	labelChangeScene,
	walletDeleteScene,
};

