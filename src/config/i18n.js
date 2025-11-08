const i18next = require("i18next");
const Backend = require("i18next-fs-backend");
const path = require("path");
const { getAvailableLanguages } = require("../utils/getAvailableLanguages");

const availableLangCodes = getAvailableLanguages().map(lang => lang.code);

// Initialize i18next synchronously (initImmediate: false ensures it completes before continuing)
let initPromise = i18next
  .use(Backend)
  .init({
    initImmediate: false,
    fallbackLng: "en",
    preload: availableLangCodes,
    ns: ["translation"],
    defaultNS: "translation",
    backend: {
      loadPath: path.join(__dirname, "../locales/{{lng}}.json"),
    },
  })
  .then(() => {
    console.log("✅ i18next initialized successfully");
    return i18next;
  })
  .catch(err => {
    console.error("❌ i18next initialization failed:", err);
    throw err;
  });

// Export both the i18next instance and the initialization promise
module.exports = i18next;
module.exports.initPromise = initPromise;
