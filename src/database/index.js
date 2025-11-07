const Database = require('better-sqlite3');
const path = require('path');
const logger = require('../utils/logger');
const { getConfig } = require('../config');

// Initialize database connection
const config = getConfig();
const dbPath = path.isAbsolute(config.databasePath) 
  ? config.databasePath 
  : path.join(__dirname, '..', '..', config.databasePath);
const db = new Database(dbPath);

// Create users table if it doesn't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        language_code TEXT,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Create wallets table if it doesn't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        address TEXT NOT NULL,
        address_hex TEXT NOT NULL,
        private_key TEXT NOT NULL,
        label TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(address),
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
`);

// Create pending_states table if it doesn't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS pending_states (
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL, -- 'withdrawal' | 'label' | 'delete'
        data TEXT NOT NULL, -- JSON string
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, type),
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_pending_states_user_id ON pending_states(user_id);
`);

// Create sessions table if it doesn't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
        user_id INTEGER PRIMARY KEY,
        data TEXT NOT NULL, -- JSON string
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);
`);

// User prepared statements
const insertUser = db.prepare(`
    INSERT INTO users (user_id, username, first_name, last_name, language_code, joined_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        language_code = excluded.language_code
`);
const updateUserLanguageCodeStmt = db.prepare('UPDATE users SET language_code = ? WHERE user_id = ?');
const getUserLanguageCodeStmt = db.prepare('SELECT language_code FROM users WHERE user_id = ?');

// Wallet prepared statements
const insertWallet = db.prepare(`
    INSERT INTO wallets (user_id, address, address_hex, private_key, label, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
`);
const getWalletByIdStmt = db.prepare('SELECT * FROM wallets WHERE id = ?');
const getWalletsByUserStmt = db.prepare('SELECT * FROM wallets WHERE user_id = ? ORDER BY created_at DESC');
const updateWalletLabelStmt = db.prepare('UPDATE wallets SET label = ? WHERE id = ?');
const deleteWalletStmt = db.prepare('DELETE FROM wallets WHERE id = ?');
const getWalletCountByUserStmt = db.prepare('SELECT COUNT(*) as count FROM wallets WHERE user_id = ?');

// Pending state prepared statements
const upsertPendingStateStmt = db.prepare(`
    INSERT INTO pending_states (user_id, type, data, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, type) DO UPDATE SET
        data = excluded.data,
        updated_at = datetime('now')
`);
const getPendingStateByUserAndTypeStmt = db.prepare(`
    SELECT data FROM pending_states WHERE user_id = ? AND type = ?
`);
const deletePendingStateStmt = db.prepare(`
    DELETE FROM pending_states WHERE user_id = ? AND type = ?
`);
const deleteOldPendingStatesStmt = db.prepare(`
    DELETE FROM pending_states WHERE updated_at < datetime('now', ?)
`);

// Session prepared statements
const upsertSessionStmt = db.prepare(`
    INSERT INTO sessions (user_id, data, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
        data = excluded.data,
        updated_at = datetime('now')
`);
const getSessionStmt = db.prepare(`
    SELECT data FROM sessions WHERE user_id = ?
`);
const deleteSessionStmt = db.prepare(`
    DELETE FROM sessions WHERE user_id = ?
`);
const deleteOldSessionsStmt = db.prepare(`
    DELETE FROM sessions WHERE updated_at < datetime('now', ?)
`);

// Database functions
const dbFunctions = {
    // Add or update a user
    addUser(user) {
        try {
            insertUser.run(
                user.id,
                user.username || null,
                user.first_name || null,
                user.last_name || null,
                user.language_code || null
            );
            return true;
        } catch (error) {
            logger.error('DB error: addUser failed', { error });
            return false;
        }
    },

    // Update a user language code
    updateUserLanguageCode(userId, languageCode) {
        try {
            updateUserLanguageCodeStmt.run(languageCode, userId);
            return true;
        } catch (error) {
            logger.error('DB error: updateUserLanguageCode failed', { error, userId });
            return false;
        }
    },

    // Get a user language code
    getUserLanguageCode(userId) {
        try {
            return getUserLanguageCodeStmt.get(userId).language_code;
        } catch (error) {
            logger.error('DB error: getUserLanguageCode failed', { error, userId });
            return null;
        }
    },
    
    // Add a wallet for a user and return the inserted row
    addWallet({ userId, address, addressHex, privateKey, label }) {
        try {
            const result = insertWallet.run(
                userId,
                address,
                addressHex,
                privateKey,
                label || null
            );
            const insertedId = result.lastInsertRowid;
            return getWalletByIdStmt.get(insertedId) || { id: insertedId };
        } catch (error) {
            logger.error('DB error: addWallet failed', { error });
            return null;
        }
    },

    // Get a wallet by its primary id
    getWalletById(id) {
        try {
            return getWalletByIdStmt.get(id) || null;
        } catch (error) {
            logger.error('DB error: getWalletById failed', { error, id });
            return null;
        }
    },

    // List all wallets for a user
    getWalletsByUser(userId) {
        try {
            return getWalletsByUserStmt.all(userId);
        } catch (error) {
            logger.error('DB error: getWalletsByUser failed', { error, userId });
            return [];
        }
    },

    // Update a wallet label
    updateWalletLabel(id, label) {
        try {
            const info = updateWalletLabelStmt.run(label, id);
            return info.changes > 0;
        } catch (error) {
            logger.error('DB error: updateWalletLabel failed', { error, id });
            return false;
        }
    },

    // Delete a wallet by id
    deleteWallet(id) {
        try {
            const info = deleteWalletStmt.run(id);
            return info.changes > 0;
        } catch (error) {
            logger.error('DB error: deleteWallet failed', { error, id });
            return false;
        }
    },

    // Count wallets for a user
    getWalletCountByUser(userId) {
        try {
            return getWalletCountByUserStmt.get(userId).count;
        } catch (error) {
            logger.error('DB error: getWalletCountByUser failed', { error, userId });
            return 0;
        }
    },

    // Persist a pending conversational state
    setPendingState(userId, type, dataObj) {
        try {
            upsertPendingStateStmt.run(userId, type, JSON.stringify(dataObj));
            return true;
        } catch (error) {
            logger.error('DB error: setPendingState failed', { error, userId, type });
            return false;
        }
    },

    // Load a pending conversational state
    getPendingState(userId, type) {
        try {
            const row = getPendingStateByUserAndTypeStmt.get(userId, type);
            if (!row) return null;
            return JSON.parse(row.data);
        } catch (error) {
            logger.error('DB error: getPendingState failed', { error, userId, type });
            return null;
        }
    },

    // Clear a pending conversational state
    clearPendingState(userId, type) {
        try {
            const info = deletePendingStateStmt.run(userId, type);
            return info.changes > 0;
        } catch (error) {
            logger.error('DB error: clearPendingState failed', { error, userId, type });
            return false;
        }
    },

    // Delete pending states older than the provided number of hours
    cleanupOldPendingStates(hours = 24) {
        try {
            const delta = `-${hours} hours`;
            const info = deleteOldPendingStatesStmt.run(delta);
            return info.changes || 0;
        } catch (error) {
            logger.error('DB error: cleanupOldPendingStates failed', { error, hours });
            return 0;
        }
    },

    // Session management functions
    // Get session data for a user
    getSession(userId) {
        try {
            const row = getSessionStmt.get(userId);
            if (!row) return null;
            return JSON.parse(row.data);
        } catch (error) {
            logger.error('DB error: getSession failed', { error, userId });
            return null;
        }
    },

    // Set session data for a user
    setSession(userId, sessionData) {
        try {
            upsertSessionStmt.run(userId, JSON.stringify(sessionData));
            return true;
        } catch (error) {
            logger.error('DB error: setSession failed', { error, userId });
            return false;
        }
    },

    // Delete session data for a user
    deleteSession(userId) {
        try {
            const info = deleteSessionStmt.run(userId);
            return info.changes > 0;
        } catch (error) {
            logger.error('DB error: deleteSession failed', { error, userId });
            return false;
        }
    },

    // Clean up old sessions older than the provided number of hours
    cleanupOldSessions(hours = 168) {
        try {
            const delta = `-${hours} hours`;
            const info = deleteOldSessionsStmt.run(delta);
            return info.changes || 0;
        } catch (error) {
            logger.error('DB error: cleanupOldSessions failed', { error, hours });
            return 0;
        }
    },

    // Close database connection
    close() {
        db.close();
    }
};

module.exports = dbFunctions;

