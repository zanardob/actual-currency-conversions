interface ConvertAccount {
  id: string;
  name: string;
  fromCurrency: string;
}

interface ActualConfig {
  syncId: string;
  convertAccounts: ConvertAccount[];
  toCurrency: string;
}

/**
 * Configuration settings for the conversions.
 */
export const ACTUAL_CONFIG: ActualConfig = {
  syncId: "5a94121f-a446-4349-a21a-53b9ce4199a0",
  convertAccounts: [
    {
      id: "<your-account-id>",
      name: "Nubank",
      fromCurrency: "BRL",
    },
    {
      id: "<your-account-id>",
      name: "XP",
      fromCurrency: "BRL",
    },
  ],
  toCurrency: "EUR",
};

/**
 * How many days to look back for account activity.
 */
export const LOOKBACK_DAYS = 365;
