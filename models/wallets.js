const { Model } = require("objection");

class Wallet extends Model {
  static get tableName() {
    return 'wallets';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['user_id', 'wallet_type', 'currency_code'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        user_id: { type: 'string', format: 'uuid' },
        wallet_type: { type: 'string', enum: ['FIAT', 'ESCROW', 'TRADEBITS', 'CREDIX'] },
        balance: { type: 'number', default: 0 },
        currency_code: { type: 'string', default: 'NGN' },
        status: { type: 'string', enum: ['active', 'frozen', 'disputed'], default: 'active' },
        
        // Monnify/Fiat specifics
        account_number: { type: ['string', 'null'] },
        bank_name: { type: ['string', 'null'] },
        account_reference: { type: ['string', 'null'] },

        // Crypto/General address specifics
        wallet_address: { type: ['string', 'null'] },
        wallet_address_tag: { type: ['string', 'null'] },
        
        is_deleted: { type: 'boolean', default: false }
      }
    };
  }
}

module.exports = Wallet;
