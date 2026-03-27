/**
 * Models Index
 * Exports all models for easy access
 */

const UserModel = require('./User');
const QRBinModel = require('./QRBin');
const CollectionModel = require('./Collection');
const ReportModel = require('./Report');
const RewardModel = require('./Reward');
const TransactionModel = require('./Transaction');
const NotificationModel = require('./Notification');

module.exports = {
    User: UserModel,
    QRBin: QRBinModel,
    Collection: CollectionModel,
    Report: ReportModel,
    Reward: RewardModel,
    Transaction: TransactionModel,
    Notification: NotificationModel
};