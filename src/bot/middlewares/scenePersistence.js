/**
 * Scene persistence middleware - auto-restores scenes from pending states
 * This allows users to continue their conversation after bot restart
 */

const db = require('../../database');
const logger = require('../../utils/logger');

/**
 * Middleware to automatically restore scenes from pending states
 * This runs after session middleware to restore scenes from pending states
 * The session middleware already restores session data, but we need to check
 * if there's a pending state that should restore the scene
 */
function sceneRestorationMiddleware() {
	return async (ctx, next) => {
		const userId = ctx.from?.id;
		if (!userId) {
			return next();
		}

		// Ensure ctx.scene is available (stage middleware must run first)
		if (!ctx.scene) {
			return next();
		}

		// Check if user is already in a scene (from restored session or active)
		const currentScene = ctx.session?.__scenes?.current;
		
		if (!currentScene) {
			// User is not in a scene - check for pending states and restore
			const pendingWithdrawal = db.getPendingState(userId, 'withdrawal');
			const pendingLabel = db.getPendingState(userId, 'label');
			const pendingDelete = db.getPendingState(userId, 'delete');

			// Priority: withdrawal > label > delete (most important first)
			if (pendingWithdrawal && pendingWithdrawal.walletId) {
				try {
					// Restore withdrawal scene with state
					// The enter handler will detect restored state and handle it appropriately
					await ctx.scene.enter('withdrawal', { walletId: pendingWithdrawal.walletId });
					// Merge pending state into scene state
					if (ctx.scene.state) {
						Object.assign(ctx.scene.state, pendingWithdrawal);
					}
					logger.info('Restored withdrawal scene from pending state', { userId, walletId: pendingWithdrawal.walletId });
					return; // Don't continue to next middleware, scene will handle it
				} catch (error) {
					logger.error('Failed to restore withdrawal scene', { error, userId });
				}
			} else if (pendingLabel && pendingLabel.walletId) {
				try {
					// Restore label change scene with state
					await ctx.scene.enter('labelChange', { walletId: pendingLabel.walletId });
					// Merge pending state into scene state
					if (ctx.scene.state) {
						Object.assign(ctx.scene.state, pendingLabel);
					}
					logger.info('Restored label change scene from pending state', { userId, walletId: pendingLabel.walletId });
					return; // Don't continue to next middleware, scene will handle it
				} catch (error) {
					logger.error('Failed to restore label change scene', { error, userId });
				}
			} else if (pendingDelete && pendingDelete.walletId) {
				try {
					// Restore wallet delete scene with state
					await ctx.scene.enter('walletDelete', { walletId: pendingDelete.walletId });
					// Merge pending state into scene state
					if (ctx.scene.state) {
						Object.assign(ctx.scene.state, pendingDelete);
					}
					logger.info('Restored wallet delete scene from pending state', { userId, walletId: pendingDelete.walletId });
					return; // Don't continue to next middleware, scene will handle it
				} catch (error) {
					logger.error('Failed to restore wallet delete scene', { error, userId });
				}
			}
		} else {
			// User is already in a scene - ensure scene state is synced with pending state
			const stateTypeMap = {
				'withdrawal': 'withdrawal',
				'labelChange': 'label',
				'walletDelete': 'delete',
			};
			
			const stateType = stateTypeMap[currentScene];
			if (stateType && ctx.scene.state) {
				const pendingState = db.getPendingState(userId, stateType);
				if (pendingState) {
					// Merge pending state into scene state to ensure consistency
					// This helps if session was partially restored
					Object.assign(ctx.scene.state, pendingState);
				}
			}
		}

		return next();
	};
}

module.exports = { sceneRestorationMiddleware };

