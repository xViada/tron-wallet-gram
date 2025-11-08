/**
 * Rate limiting middleware
 */

// Simple per-user rate limiter middleware
const rateLimitStore = new Map();

/**
 * Rate limit middleware factory
 * @param {Object} options - Rate limit options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {number} options.blockMs - Block duration in milliseconds
 */
function rateLimit({ windowMs = 10000, max = 8, blockMs = 15000 } = {}) {
	return async (ctx, next) => {
		const userId = ctx.from?.id;
		if (!userId) return next();

		const now = Date.now();
		let entry = rateLimitStore.get(userId);
		if (!entry) {
			entry = { hits: [], blockedUntil: 0 };
			rateLimitStore.set(userId, entry);
		}

		// If user is currently blocked
		if (entry.blockedUntil && now < entry.blockedUntil) {
			if (ctx.updateType === 'callback_query') {
				try { await ctx.answerCbQuery(ctx.t('ui.slow_down'), { show_alert: false }); } catch {}
			} else {
				try { await ctx.reply(ctx.t('ui.too_many_requests')); } catch {}
			}
			return;
		}

		// Prune timestamps outside the window
		entry.hits = entry.hits.filter(ts => now - ts < windowMs);

		if (entry.hits.length >= max) {
			entry.blockedUntil = now + blockMs;
			if (ctx.updateType === 'callback_query') {
				try { await ctx.answerCbQuery(ctx.t('ui.slow_down'), { show_alert: false }); } catch {}
			} else {
				try { await ctx.reply(ctx.t('ui.too_many_requests')); } catch {}
			}
			return;
		}

		entry.hits.push(now);
		return next();
	};
}

module.exports = { rateLimit };

