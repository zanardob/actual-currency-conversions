import actualApi from "@actual-app/api";
import { ACTUAL_CONFIG } from "../config.js";

const main = async () => {
  await actualApi.init({
    dataDir: "./actual-cache",
    serverURL: process.env.ACTUAL_SERVER_URL || "http://localhost:5006",
    password: process.env.ACTUAL_PASSWORD,
  });
  await actualApi.downloadBudget(ACTUAL_CONFIG.syncId);

  try {
    const accounts = await actualApi.getAccounts();
    console.log(accounts);
  } catch (e) {
    console.error(e);
  } finally {
    await actualApi.shutdown();
  }
};

await main();
