/**
 * Wallet-related utility functions
 */

const TRX_TO_SUN = 1000000;
const MIN_BALANCE_FOR_WITHDRAWAL = 2 * TRX_TO_SUN; // 2 TRX in sun
const MIN_TRX_FOR_FEES = 2; // Keep 2 TRX for fees

/**
 * Convert sun to TRX
 */
function sunToTRX(sun) {
  return sun / TRX_TO_SUN;
}

/**
 * Convert TRX to sun
 */
function trxToSun(trx) {
  return trx * TRX_TO_SUN;
}

/**
 * Check if wallet has sufficient balance for withdrawal
 */
function hasSufficientBalance(balanceInSun) {
  return balanceInSun >= MIN_BALANCE_FOR_WITHDRAWAL;
}

/**
 * Calculate maximum withdrawable amount (balance - fees)
 */
function getMaxWithdrawable(balanceInTRX) {
  return Math.max(0, balanceInTRX - MIN_TRX_FOR_FEES);
}

/**
 * Validate wallet ownership
 */
function validateWalletOwnership(wallet, userId) {
  return wallet && wallet.user_id === userId;
}

/**
 * Format wallet balance display
 */
function formatBalance(balanceInSun) {
  return sunToTRX(balanceInSun).toFixed(6);
}

module.exports = {
  TRX_TO_SUN,
  MIN_BALANCE_FOR_WITHDRAWAL,
  MIN_TRX_FOR_FEES,
  sunToTRX,
  trxToSun,
  hasSufficientBalance,
  getMaxWithdrawable,
  validateWalletOwnership,
  formatBalance,
};

