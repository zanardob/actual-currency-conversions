// Use ISO 4217 for currency codes
const Config = {
  // Under Actual > Advanced Settings
  syncId: "5a94121f-a446-4349-a21a-53b9ce4199a0",
  // How many days of historical rates to fetch
  history: 90,
  convertAccounts: [
    {
      id: "<your-account-id>",
      fromCurrency: "BRL",
    },
  ],
  toCurrency: "EUR",
};

export default Config;
