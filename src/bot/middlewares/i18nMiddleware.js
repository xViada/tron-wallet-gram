const i18next = require("../../config/i18n");
const db = require("../../database");

const i18nMiddleware = async (ctx, next) => {
    if (!ctx.from) return next();

    // Ensure i18next is initialized before use
    if (i18next.initPromise) {
        await i18next.initPromise;
    }

    const userId = ctx.from.id;

    const userLangCode = await db.getUserLanguageCode(userId);
    const userLang = userLangCode || "en";

    ctx.t = (key, options = {}) => {
        // If key is not a string, return it as-is (fallback)
        if (typeof key !== 'string') {
            return key;
        }
        return i18next.t(key, { lng: userLang, ...options });
    };

    return next();
};

module.exports = { i18nMiddleware };
