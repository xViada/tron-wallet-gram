/**
 * Message formatting and response utilities
 */

/**
 * Safely edit or send a message (handles edit failures gracefully)
 */
async function safeEditOrSend(ctx, text, keyboard = null) {
  try {
    await ctx.editMessageText(text, keyboard);
  } catch (error) {
    // If editing fails, try to delete and send new message
    try {
      await ctx.deleteMessage();
    } catch (deleteError) {
      // If deletion fails, just continue
    }
    await ctx.reply(text, keyboard);
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
function formatWalletInfo(wallet, balanceInTRX) {
  return `👛 ${wallet.label || 'Wallet'}\n\n` +
    `Address: \`${wallet.address}\`\n` +
    `Balance: ${balanceInTRX} TRX\n` +
    `Created: ${new Date(wallet.created_at).toLocaleString()}`;
}

/**
 * Format wallet info with error balance
 */
function formatWalletInfoError(wallet) {
  return `👛 ${wallet.label || 'Wallet'}\n\n` +
    `Address: \`${wallet.address}\`\n` +
    `Balance: Error loading balance\n` +
    `Created: ${new Date(wallet.created_at).toLocaleString()}`;
}

/**
 * Format deposit message
 */
function formatDepositMessage(wallet) {
  return `💰 Deposit to ${wallet.label || 'Wallet'}\n\n` +
    `Address: \`${wallet.address}\`\n\n` +
    `Send TRX to this address to deposit funds.`;
}

/**
 * Format withdrawal success message
 */
function formatWithdrawalSuccess(amount, toAddress, txHash) {
  return `✅ Withdrawal successful!\n\n` +
    `Amount: ${amount} TRX\n` +
    `To: \`${toAddress}\`\n` +
    `Transaction: \`${txHash}\``;
}

/**
 * Format transaction history message
 */
function formatTransactionHistory(transactions, walletAddress) {
  if (transactions.length === 0) {
    return `📊 Transaction History\n\nNo transactions found for this wallet.`;
  }

  let message = `📊 Transaction History (Last ${transactions.length})\n\n`;
  
  transactions.slice(0, 10).forEach((tx, index) => {
    const formatted = tx.formatted;
    message += `${index + 1}. ${formatted.direction}\n`;
    message += `   Amount: ${formatted.amount}\n`;
    message += `   Date: ${formatted.date}\n`;
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
};

