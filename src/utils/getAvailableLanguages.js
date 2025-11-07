const fs = require('fs');
const path = require('path');

function getAvailableLanguages() {
  const localesDir = path.resolve('src/locales');
  const files = fs.readdirSync(localesDir);

  const langs = [];

  for (const file of files) {
    if (!file.endsWith('.json') && !file.endsWith('.yaml') && !file.endsWith('.yml')) continue;

    const langCode = path.basename(file, path.extname(file));
    const content = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));

    const name = content.meta?.name || langCode.toUpperCase();
    const flag = content.meta?.flag || '🏳️';
    langs.push({ code: langCode, name, flag });
  }

  return langs;
}

module.exports = { getAvailableLanguages };