import cron from "node-cron"
import { convertCurrencies } from "./convertCurrencies"

// Top of every hour, UTC
let isRunning = false
const task = cron.schedule(
  "0 * * * *",
  async () => {
    if (isRunning) {
      console.log("Previous conversion job still running, skipping this tick.")
      return
    }
    isRunning = true
    try {
      await convertCurrencies()
    } catch (error) {
      console.error("Conversion job failed:", error)
    } finally {
      isRunning = false
    }
  },
  { timezone: "UTC" },
)

console.log("Cron scheduler started: running hourly at :00 UTC")

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
