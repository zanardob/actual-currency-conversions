import cron from "node-cron"
import { convertCurrencies } from "./convertCurrencies"

// 00:00 UTC daily
cron.schedule(
  "0 0 * * *",
  () => {
    convertCurrencies()
  },
  { timezone: "UTC" },
)

console.log("Cron scheduler started: running daily at 00:00 UTC")
