/**
 * @typedef {Object} ConvertAccount
 * @property {string} id - Actual Budget account ID
 * @property {string} fromCurrency - ISO4217 currency code to convert from
 */

/**
 * @typedef {Object} ActualConfig
 * @property {string} syncId - Actual Budget sync ID (found under Advanced Settings)
 * @property {ConvertAccount[]} convertAccounts - Accounts to convert transactions from
 * @property {string} toCurrency - ISO4217 currency code to convert to
 */

/**
 * Configuration for Actual Budget currency conversion.
 * @type {ActualConfig}
 */
export const ACTUAL_CONFIG = {
  syncId: "5a94121f-a446-4349-a21a-53b9ce4199a0",
  convertAccounts: [
    {
      id: "<your-account-id>",
      fromCurrency: "BRL",
    },
  ],
  toCurrency: "EUR",
};
