import actualApi from "@actual-app/api";
import Exchange from "./lib/exchangeRates.js";
import Config from "./config.js";

const main = async () => {
  await actualApi.init({
    dataDir: "./actual-cache",
    serverURL: process.env.ACTUAL_SERVER_URL || "http://localhost:5006",
    password: process.env.ACTUAL_PASSWORD,
  });
  await actualApi.downloadBudget(Config.syncId);

  for (let account of Config.convertAccounts) {
    try {
      const exchange = new Exchange({
        fromCurrency: account.fromCurrency,
        toCurrency: Config.toCurrency,
      });

      let transactions = await actualApi.getTransactions(account.id);
      let convertedTransactionsCount = 0;

      // Check if there are transactions to convert
      transactions = transactions.filter((transaction) =>
        !transaction.notes?.includes(`${account.fromCurrency} @`)
      );
      if (transactions.length === 0) {
        console.log(
          `No transactions to convert for account ${account.id} (${account.fromCurrency} to ${Config.toCurrency}).`
        );
        continue;
      }

      await exchange.fetchRates();

      for (let transaction of transactions) {
        // Values are in cents; rounded after conversion
        const { amount, rate } = exchange.applyRate(transaction.amount, transaction.date);
        if (!amount) {
          console.warn(
            `Skipping transaction ${JSON.stringify(transaction)} as no conversion rate was found.`
          );
          continue;
        }

        const originalAmount = (transaction.amount / 100).toFixed(2)
        const formattedRate = Number.parseFloat((rate).toFixed(6)).toString()
        const noteSuffix = transaction.notes ? ` • ${transaction.notes}` : ''

        await actualApi.updateTransaction(transaction.id, {
          notes: `${originalAmount} ${account.fromCurrency} @ ${formattedRate}${noteSuffix}`,
          amount: amount,
        });
        convertedTransactionsCount++;
      }

      console.log(`Converted ${convertedTransactionsCount} transactions.`);
    } catch (e) {
      console.error(e);
    }
  }

  await actualApi.shutdown();
}

await main();
