function sanitizeLabel(input) {
    const normalized = (input ?? '').normalize('NFC').trim();

    // Remove control characters including newlines and tabs
    let cleaned = normalized.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

    // Collapse internal whitespace
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Enforce max length of 20 characters (defense-in-depth)
    if (cleaned.length > 20) cleaned = cleaned.slice(0, 20).trim();

    return cleaned;
}

module.exports = { sanitizeLabel };

