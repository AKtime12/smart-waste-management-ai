/**
 * Blockchain Service for Transparent Point Tracking
 * This service provides blockchain-like verification for point transactions
 */

const crypto = require('crypto');

class BlockchainService {
    constructor() {
        this.chain = [];
        this.pendingTransactions = [];
        this.difficulty = 4; // Number of leading zeros required
        this.miningReward = 10; // Points reward for mining
        this.initializeGenesisBlock();
    }
    
    // =============================================
    // Block Operations
    // =============================================
    
    initializeGenesisBlock() {
        const genesisBlock = this.createGenesisBlock();
        this.chain.push(genesisBlock);
    }
    
    createGenesisBlock() {
        return {
            index: 0,
            timestamp: new Date('2024-01-01'),
            transactions: [],
            previousHash: '0',
            hash: this.calculateHash(0, new Date('2024-01-01'), [], '0', 0),
            nonce: 0,
            proof: 'GENESIS'
        };
    }
    
    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }
    
    calculateHash(index, timestamp, transactions, previousHash, nonce) {
        const data = index + timestamp + JSON.stringify(transactions) + previousHash + nonce;
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    
    proofOfWork(block) {
        let hash = this.calculateHash(
            block.index,
            block.timestamp,
            block.transactions,
            block.previousHash,
            block.nonce
        );
        
        while (hash.substring(0, this.difficulty) !== Array(this.difficulty + 1).join('0')) {
            block.nonce++;
            hash = this.calculateHash(
                block.index,
                block.timestamp,
                block.transactions,
                block.previousHash,
                block.nonce
            );
        }
        
        return hash;
    }
    
    // =============================================
    // Transaction Operations
    // =============================================
    
    createTransaction(transaction) {
        const newTransaction = {
            id: crypto.randomBytes(16).toString('hex'),
            from: transaction.from || 'SYSTEM',
            to: transaction.to,
            amount: transaction.amount,
            type: transaction.type, // 'collection', 'reward', 'redemption', 'bonus'
            timestamp: new Date(),
            signature: this.signTransaction(transaction),
            metadata: transaction.metadata || {}
        };
        
        this.pendingTransactions.push(newTransaction);
        return newTransaction;
    }
    
    signTransaction(transaction) {
        const data = transaction.from + transaction.to + transaction.amount + transaction.type;
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    
    verifyTransaction(transaction) {
        const expectedSignature = this.signTransaction(transaction);
        return transaction.signature === expectedSignature;
    }
    
    minePendingTransactions(minerAddress) {
        // Create new block
        const block = {
            index: this.chain.length,
            timestamp: new Date(),
            transactions: [...this.pendingTransactions],
            previousHash: this.getLatestBlock().hash,
            nonce: 0,
            hash: ''
        };
        
        // Proof of work
        block.hash = this.proofOfWork(block);
        
        // Add block to chain
        this.chain.push(block);
        
        // Clear pending transactions
        this.pendingTransactions = [];
        
        // Add mining reward
        if (minerAddress) {
            this.createTransaction({
                from: 'SYSTEM',
                to: minerAddress,
                amount: this.miningReward,
                type: 'mining_reward'
            });
        }
        
        return block;
    }
    
    // =============================================
    // Point Verification
    // =============================================
    
    getUserBalance(userId) {
        let balance = 0;
        
        for (const block of this.chain) {
            for (const transaction of block.transactions) {
                if (transaction.to === userId) {
                    balance += transaction.amount;
                }
                if (transaction.from === userId) {
                    balance -= transaction.amount;
                }
            }
        }
        
        // Add pending transactions
        for (const transaction of this.pendingTransactions) {
            if (transaction.to === userId) {
                balance += transaction.amount;
            }
            if (transaction.from === userId) {
                balance -= transaction.amount;
            }
        }
        
        return balance;
    }
    
    getUserTransactionHistory(userId, limit = 50) {
        const transactions = [];
        
        for (const block of this.chain) {
            for (const transaction of block.transactions) {
                if (transaction.to === userId || transaction.from === userId) {
                    transactions.push({
                        ...transaction,
                        blockIndex: block.index,
                        blockHash: block.hash,
                        confirmed: true
                    });
                }
            }
        }
        
        // Add pending transactions
        for (const transaction of this.pendingTransactions) {
            if (transaction.to === userId || transaction.from === userId) {
                transactions.push({
                    ...transaction,
                    confirmed: false
                });
            }
        }
        
        // Sort by timestamp (newest first)
        transactions.sort((a, b) => b.timestamp - a.timestamp);
        
        return transactions.slice(0, limit);
    }
    
    // =============================================
    // Smart Contracts for Rewards
    // =============================================
    
    createRewardContract(reward) {
        const contract = {
            id: crypto.randomBytes(16).toString('hex'),
            name: reward.name,
            description: reward.description,
            pointsRequired: reward.points,
            totalSupply: reward.stock,
            remainingSupply: reward.stock,
            validUntil: reward.validUntil || null,
            createdAt: new Date(),
            redemptions: [],
            isActive: true
        };
        
        return contract;
    }
    
    redeemReward(userId, rewardContract) {
        if (!rewardContract.isActive) {
            return { success: false, error: 'Reward is no longer active' };
        }
        
        if (rewardContract.remainingSupply <= 0) {
            return { success: false, error: 'Reward out of stock' };
        }
        
        const userBalance = this.getUserBalance(userId);
        if (userBalance < rewardContract.pointsRequired) {
            return { success: false, error: 'Insufficient points' };
        }
        
        // Create redemption transaction
        const redemption = {
            userId: userId,
            rewardId: rewardContract.id,
            rewardName: rewardContract.name,
            points: rewardContract.pointsRequired,
            timestamp: new Date(),
            redemptionCode: crypto.randomBytes(8).toString('hex')
        };
        
        // Deduct points
        this.createTransaction({
            from: userId,
            to: 'SYSTEM',
            amount: rewardContract.pointsRequired,
            type: 'reward_redemption',
            metadata: { rewardId: rewardContract.id, rewardName: rewardContract.name }
        });
        
        // Update contract
        rewardContract.remainingSupply--;
        rewardContract.redemptions.push(redemption);
        
        return {
            success: true,
            redemptionCode: redemption.redemptionCode,
            remainingPoints: userBalance - rewardContract.pointsRequired
        };
    }
    
    // =============================================
    // Chain Verification
    // =============================================
    
    isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];
            
            // Verify hash
            const calculatedHash = this.calculateHash(
                currentBlock.index,
                currentBlock.timestamp,
                currentBlock.transactions,
                currentBlock.previousHash,
                currentBlock.nonce
            );
            
            if (currentBlock.hash !== calculatedHash) {
                return false;
            }
            
            // Verify previous hash
            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }
        }
        
        return true;
    }
    
    getChainStats() {
        const totalTransactions = this.chain.reduce((sum, block) => sum + block.transactions.length, 0);
        const totalPoints = this.getTotalPointsInSystem();
        
        return {
            totalBlocks: this.chain.length,
            totalTransactions: totalTransactions,
            totalPoints: totalPoints,
            pendingTransactions: this.pendingTransactions.length,
            isChainValid: this.isChainValid(),
            lastBlockTime: this.getLatestBlock().timestamp,
            difficulty: this.difficulty
        };
    }
    
    getTotalPointsInSystem() {
        let total = 0;
        
        for (const block of this.chain) {
            for (const transaction of block.transactions) {
                if (transaction.from === 'SYSTEM') {
                    total += transaction.amount;
                }
                if (transaction.to === 'SYSTEM') {
                    total -= transaction.amount;
                }
            }
        }
        
        return total;
    }
    
    // =============================================
    // Audit & Reporting
    // =============================================
    
    getAuditReport() {
        const users = new Set();
        const transactionsByType = {
            collection: 0,
            reward: 0,
            redemption: 0,
            bonus: 0,
            mining_reward: 0
        };
        
        for (const block of this.chain) {
            for (const transaction of block.transactions) {
                users.add(transaction.from);
                users.add(transaction.to);
                if (transactionsByType[transaction.type] !== undefined) {
                    transactionsByType[transaction.type]++;
                }
            }
        }
        
        return {
            totalUsers: users.size,
            transactionsByType: transactionsByType,
            chainStats: this.getChainStats(),
            verified: this.isChainValid(),
            reportGenerated: new Date()
        };
    }
    
    // =============================================
    // Export for Backup
    // =============================================
    
    exportChain() {
        return {
            chain: this.chain,
            pendingTransactions: this.pendingTransactions,
            difficulty: this.difficulty,
            miningReward: this.miningReward,
            exportedAt: new Date(),
            version: '1.0'
        };
    }
    
    importChain(data) {
        if (data.version !== '1.0') {
            throw new Error('Incompatible chain version');
        }
        
        this.chain = data.chain;
        this.pendingTransactions = data.pendingTransactions;
        this.difficulty = data.difficulty;
        this.miningReward = data.miningReward;
        
        return this.isChainValid();
    }
}

module.exports = BlockchainService;