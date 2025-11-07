const ns = 'tron-wallet-gram';

function format(level, message, meta) {
  const time = new Date().toISOString();
  const base = `[${time}] [${ns}] [${level}] ${message}`;
  if (!meta) return base;
  try {
    return `${base} ${JSON.stringify(meta)}`;
  } catch (_) {
    return base;
  }
}

module.exports = {
  info(message, meta) {
    console.log(format('INFO', message, meta));
  },
  warn(message, meta) {
    console.warn(format('WARN', message, meta));
  },
  error(message, meta) {
    if (meta && meta.error && meta.error.stack) {
      console.error(format('ERROR', message, { ...meta, error: meta.error.message }));
      console.error(meta.error.stack);
    } else {
      console.error(format('ERROR', message, meta));
    }
  },
};

