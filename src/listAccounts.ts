import actualApi from "@actual-app/api"
import { ACTUAL_CONFIG } from "./config"

/**
 * Lists all accounts in the configured Actual Budget instance.
 */
const listAccounts = async () => {
  console.log("Fetching accounts...")

  await actualApi.init({
    dataDir: "./actual-cache",
    serverURL: process.env.ACTUAL_SERVER_URL,
    password: process.env.ACTUAL_PASSWORD,
  })
  await actualApi.downloadBudget(ACTUAL_CONFIG.syncId)

  try {
    const accounts = await actualApi.getAccounts()
    console.log(accounts)
  } catch (e) {
    console.error(e)
  } finally {
    await actualApi.shutdown()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  listAccounts()
}
