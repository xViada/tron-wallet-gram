/**
 * Message formatting and response utilities
 */

/**
 * Format date in a consistent, bot-friendly format (YYYY-MM-DD HH:MM)
 */
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Safely edit or send a message (handles edit failures gracefully)
 */
async function safeEditOrSend(ctx, text, keyboard = null) {
  try {
    await ctx.editMessageText(ctx.t(text), keyboard);
  } catch (error) {
    // If editing fails, try to delete and send new message
    try {
      await ctx.deleteMessage();
    } catch (deleteError) {
      // If deletion fails, just continue
    }
    await ctx.reply(ctx.t(text), keyboard);
  }
}

/**
 * Safely delete a message (handles delete failures gracefully)
 */
async function safeDeleteMessage(ctx) {
  try {
    await ctx.deleteMessage();
  } catch (error) {
    logger.error('Error deleting message', { error });
  }
} 

/**
 * Format wallet info message
 */
function formatWalletInfo(ctx, wallet, balanceInTRX) {
  return `👛 ${wallet.label || 'Wallet'}\n\n` +
    ctx.t('wallet.general.address', { address: wallet.address }) + '\n' +
    ctx.t('wallet.general.balance', { balance: balanceInTRX }) + ' TRX' + '\n' +
    ctx.t('wallet.general.created_at', { created: formatDate(wallet.created_at) });
}

/**
 * Format wallet info with error balance
 */
function formatWalletInfoError(ctx, wallet) {
  return `👛 ${wallet.label || 'Wallet'}\n\n` +
    ctx.t('wallet.general.address', { address: wallet.address }) + '\n' +
    ctx.t('wallet.general.balance', { balance: 'Error loading balance' }) + '\n' +
    ctx.t('wallet.general.created_at', { created: formatDate(wallet.created_at) });
}

/**
 * Escape Markdown special characters for Telegram
 */
function escapeMarkdown(text) {
  if (!text) return text;
  // Escape special Markdown characters: _ * [ ] ( ) ~ ` > # + - . !
  return String(text).replace(/([_*\[\]()~`>#+\-.!])/g, '\\$1');
}

/**
 * Format deposit message
 */
function formatDepositMessage(ctx, wallet) {
  const escapedLabel = escapeMarkdown(wallet.label || 'Wallet');
  return ctx.t('wallet.deposit.message', { walletLabel: escapedLabel, address: wallet.address });
}

/**
 * Format withdrawal success message
 */
function formatWithdrawalSuccess(ctx, amount, toAddress, txHash) {
  return ctx.t('wallet.withdrawal.success', { amount: amount }) + '\n\n' +
    ctx.t('wallet.withdrawal.to', { toAddress: toAddress }) + '\n' +
    ctx.t('wallet.withdrawal.transaction', { txHash: txHash });
}

/**
 * Format transaction history message
 */
function formatTransactionHistory(ctx, transactions) {
  if (transactions.length === 0) {
    return ctx.t('wallet.transactions.none_found');
  }

  let message = ctx.t('wallet.transactions.history_title', { count: transactions.length }) + '\n\n';
  
  transactions.slice(0, 10).forEach((tx, index) => {
    const formatted = tx.formatted;
    message += `${index + 1}. ${formatted.direction}\n`;
    message += `   ${ctx.t('wallet.transactions.amount')} ${formatted.amount}\n`;
    message += `   ${ctx.t('wallet.transactions.date')} ${formatted.date}\n`;
    message += `   TX: \`${formatted.txID}\`\n\n`;
  });
  
  return message;
}

module.exports = {
  safeEditOrSend,
  safeDeleteMessage,
  formatWalletInfo,
  formatWalletInfoError,
  formatDepositMessage,
  formatWithdrawalSuccess,
  formatTransactionHistory,
  escapeMarkdown,
};

