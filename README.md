# TRON Wallet Telegram Bot

A Telegram bot for managing TRON wallets.
Create and manage multiple wallets, send and receive TRX, view transaction history, and manage balances — all directly from Telegram.
## Features

- Wallet Management

    - Create multiple TRON wallets
    - Add custom labels
    - View balances in real time
    - Delete wallets safely

- Transactions

    - Send TRX (withdrawal)
    - Receive TRX via deposit QR codes
    - View transaction history (TRX & TRC20)
    - Real-time balance updates

- User Experience

    - Multi-language support (In progress)
    - Interactive keyboards
    - Scene-based workflows
    - Session persistence across restarts
    - Rate limiting for smooth performance

- Security

    - Secure private key storage
    - Wallet ownership validation
    - Transaction verification
    - Rate-limiting protection

## Tech Stack

- Node.js with Telegraf
- TronWeb for TRON blockchain integration
- SQLite for data persistence
- QR Code generation for deposits


## Usage

    1. Start a chat with the bot on Telegram
    2. Create a wallet
    3. Deposit TRX using the generated QR code/address
    4. Send TRX to any TRON address
    5. View transaction history and manage wallets


## Requirements
- Node.js
- Telegram Bot Token
- TRON network access (mainnet/testnet)