import actualApi from "@actual-app/api";
import cron from "node-cron";
import dayjs from "dayjs";
import createExchange from "./exchangeRates.js";
import { ACTUAL_CONFIG } from "./config.js";

/**
 * Converts transactions in configured accounts from their source currency to the target currency.
 */
const convert = async () => {
  console.log("Starting conversion job...");

  await actualApi.init({
    dataDir: "./actual-cache",
    serverURL: process.env.ACTUAL_SERVER_URL || "http://localhost:5006",
    password: process.env.ACTUAL_PASSWORD,
  });
  await actualApi.downloadBudget(ACTUAL_CONFIG.syncId);

  for (let account of ACTUAL_CONFIG.convertAccounts) {
    try {
      const exchange = createExchange({
        fromCurrency: account.fromCurrency,
        toCurrency: ACTUAL_CONFIG.toCurrency,
      });

      const dateStart = dayjs().subtract(365, "days").format("YYYY-MM-DD");
      const dateEnd = dayjs().format("YYYY-MM-DD");
      let transactions = await actualApi.getTransactions(account.id, dateStart, dateEnd);
      let convertedTransactionsCount = 0;

      // Check if there are transactions to convert
      transactions = transactions.filter((transaction) =>
        !transaction.notes?.includes(`${account.fromCurrency} @`)
      );
      if (transactions.length === 0) {
        console.log(
          `No transactions to convert for account ${account.name} (${account.fromCurrency} to ${ACTUAL_CONFIG.toCurrency}).`
        );
        continue;
      }

      await exchange.fetchRates();

      for (let transaction of transactions) {
        const { amount, rate } = exchange.applyRate(transaction.amount, transaction.date);
        if (amount === undefined || rate === undefined) {
          console.warn(
            `Skipping transaction ${JSON.stringify(transaction)} as no conversion rate was found.`
          );
          continue;
        }

        const originalAmount = (transaction.amount / 100).toFixed(2);
        const formattedRate = Number.parseFloat(rate.toFixed(6)).toString();
        const noteSuffix = transaction.notes ? ` • ${transaction.notes}` : "";

        await actualApi.updateTransaction(transaction.id, {
          notes: `${originalAmount} ${account.fromCurrency} @ ${formattedRate}${noteSuffix}`,
          amount: amount,
        });
        convertedTransactionsCount++;
      }

      console.log(`Converted ${convertedTransactionsCount} transactions for account ${account.id}.`);
    } catch (e) {
      console.error(e);
    }
  }

  await actualApi.shutdown();
  console.log("Conversion job finished.");
};

// 00:00 UTC daily
cron.schedule("0 0 * * *", () => {
  convert();
}, {
  timezone: "UTC"
});

console.log("Cron scheduler started: running daily at 00:00 UTC");

// Allow manual run if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    convert();
}
