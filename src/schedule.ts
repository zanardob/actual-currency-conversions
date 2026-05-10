import cron from "node-cron"
import { convertCurrencies } from "./convertCurrencies"

// 00:00 UTC daily
const task = cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      await convertCurrencies()
    } catch (error) {
      console.error("Conversion job failed:", error)
    }
  },
  { timezone: "UTC" },
)

console.log("Cron scheduler started: running daily at 00:00 UTC")

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, stopping cron scheduler...")
  task.stop()
  process.exit(0)
})

process.on("SIGINT", () => {
  console.log("SIGINT received, stopping cron scheduler...")
  task.stop()
  process.exit(0)
})
