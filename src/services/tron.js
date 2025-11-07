const { TronWeb } = require('tronweb');
const QRCode = require('qrcode');
const https = require('https');
const { AppError, asAppError } = require('../utils/errors');
const logger = require('../utils/logger');
const { getConfig } = require('../config');

const config = getConfig();
const tronWeb = new TronWeb({
  fullHost: config.tronNetwork
});

/**
 * Generate a new TRON wallet
 */
async function generateWallet() {
  try {
    const account = await tronWeb.createAccount();
    return account;
  } catch (error) {
    throw asAppError(error, 'WALLET_CREATE_FAILED', 'Failed to create wallet. Please try again.');
  }
}

/**
 * Get TRX balance for an address
 */
async function getBalance(address) {
  try {
    const balance = await tronWeb.trx.getBalance(address);
    return balance;
  } catch (error) {
    throw asAppError(error, 'BALANCE_FETCH_FAILED', 'Could not fetch balance. Please try again.');
  }
}

/**
 * Send TRX transaction
 */
async function sendTransaction(fromPrivateKey, toAddress, amountInTRX) {
  try {
    const privateKey = fromPrivateKey;
    const address = tronWeb.address.fromPrivateKey(privateKey);
    
    // Convert TRX to sun (1 TRX = 1,000,000 sun)
    const amountInSun = amountInTRX * 1000000;
    
    // Build the transaction
    const transaction = await tronWeb.transactionBuilder.sendTrx(
      toAddress,
      amountInSun,
      address
    );
    
    // Sign the transaction
    const signedTransaction = await tronWeb.trx.sign(transaction, privateKey);
    
    // Broadcast the transaction
    const result = await tronWeb.trx.broadcast(signedTransaction);
    
    return result;
  } catch (error) {
    throw asAppError(error, 'TX_BROADCAST_FAILED', 'Transaction failed. Please try again.');
  }
}

/**
 * Validate Tron address
 */
function isValidTronAddress(address) {
  return tronWeb.isAddress(address);
}

/**
 * Get transactions from AND to an address using TronGrid API
 */
async function getAllTransactions(address, limit = 20) {
  try {
    const baseUrl = config.tronNetwork.replace(/^https?:\/\//, '').split('/')[0];
    
    // Get TRX transactions (native TRX transfers)
    const trxTransactions = await getTRXTransactions(baseUrl, address, limit);
    
    // Get TRC20 token transactions (if any)
    const trc20Transactions = await getTRC20Transactions(baseUrl, address, limit);
    
    // Combine all transactions
    const allTransactions = [...trxTransactions, ...trc20Transactions];
    
    // Sort by timestamp (newest first)
    allTransactions.sort((a, b) => {
      const timeA = a.block_timestamp || 0;
      const timeB = b.block_timestamp || 0;
      return timeB - timeA;
    });
    
    // Remove duplicates and limit results
    const uniqueTxs = allTransactions
      .filter((tx, index, self) => 
        index === self.findIndex(t => (t.txID || t.transaction_id) === (tx.txID || tx.transaction_id))
      )
      .slice(0, limit);
    
    return uniqueTxs;
  } catch (error) {
    throw asAppError(error, 'TX_HISTORY_FAILED', 'Could not load transactions. Please try again.');
  }
}

/**
 * Get TRX transactions using TronGrid API
 */
function getTRXTransactions(baseUrl, address, limit) {
  return new Promise((resolve, reject) => {
    const path = `/v1/accounts/${address}/transactions?limit=${limit}&only_confirmed=true&only_to=false`;
    
    const options = {
      hostname: baseUrl,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          // Process TRX transactions
          const transactions = (response.data || []).map(tx => {
            // Extract TRX transfer from transaction
            const contract = tx.raw_data?.contract?.[0];
            if (contract?.type === 'TransferContract') {
              const parameter = contract.parameter?.value;
              return {
                txID: tx.txID || tx.transaction_id,
                type: 'TRX',
                from: tronWeb.address.fromHex(parameter.owner_address || ''),
                to: tronWeb.address.fromHex(parameter.to_address || ''),
                amount: parameter.amount || 0,
                block_timestamp: tx.block_timestamp,
                confirmed: tx.ret?.[0]?.contractRet === 'SUCCESS'
              };
            }
            return null;
          }).filter(tx => tx !== null);
          
          resolve(transactions);
        } catch (error) {
          reject(asAppError(error, 'TRX_TX_PARSE_FAILED'));
        }
      });
    });

    req.on('error', (error) => {
      reject(asAppError(error, 'TRX_TX_HTTP_FAILED'));
    });

    req.end();
  });
}

/**
 * Get TRC20 token transactions
 */
function getTRC20Transactions(baseUrl, address, limit) {
  return new Promise((resolve, reject) => {
    const path = `/v1/accounts/${address}/transactions/trc20?limit=${limit}&only_confirmed=true`;
    
    const options = {
      hostname: baseUrl,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          const transactions = (response.data || []).map(tx => ({
            txID: tx.transaction_id,
            type: 'TRC20',
            from: tx.from,
            to: tx.to,
            amount: tx.value || 0,
            token: tx.token_info?.symbol || 'TRC20',
            block_timestamp: tx.block_timestamp,
            confirmed: true
          }));
          
          resolve(transactions);
        } catch (error) {
          // If error, return empty array instead of rejecting
          resolve([]);
        }
      });
    });

    req.on('error', (error) => {
      // Return empty array on error instead of rejecting
      resolve([]);
    });

    req.end();
  });
}

/**
 * Format transaction for display
 */
function formatTransaction(tx, address) {
  const isIncoming = tx.to && tx.to.toLowerCase() === address.toLowerCase();
  const direction = isIncoming ? '⬇️ Received' : '⬆️ Sent';
  
  // Handle TRX and TRC20 amounts
  let amount, amountStr;
  if (tx.type === 'TRC20') {
    // TRC20 amounts need to be divided by token decimals (usually 18, but we'll use 6 as default)
    const decimals = tx.token_info?.decimals || 6;
    amount = parseInt(tx.amount) / Math.pow(10, decimals);
    amountStr = `${amount.toFixed(6)} ${tx.token || 'TRC20'}`;
  } else {
    // TRX amount (in sun)
    amount = tx.amount ? (tx.amount / 1000000).toFixed(6) : '0';
    amountStr = `${amount} TRX`;
  }
  
  const date = tx.block_timestamp 
    ? new Date(tx.block_timestamp).toLocaleString() 
    : 'Unknown';
  
  return {
    txID: tx.txID || tx.transaction_id,
    direction: direction,
    amount: amountStr,
    from: tx.from || 'Unknown',
    to: tx.to || 'Unknown',
    date: date,
    confirmed: tx.confirmed !== false,
    type: tx.type || 'TRX'
  };
}

/**
 * Generate QR code buffer from address
 */
async function generateQRCode(address) {
  try {
    // Generate QR code as a buffer (PNG format)
    const qrBuffer = await QRCode.toBuffer(address, {
      type: 'png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrBuffer;
  } catch (error) {
    throw asAppError(error, 'QR_GEN_FAILED', 'Could not generate QR code.');
  }
}

module.exports = { 
  generateWallet, 
  getBalance, 
  sendTransaction, 
  isValidTronAddress,
  getAllTransactions,
  formatTransaction,
  generateQRCode
};

