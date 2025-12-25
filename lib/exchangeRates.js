import dayjs from "dayjs";

const LOOKBACK_DAYS = 365;

// Uses inverted rates because we're usually converting from a weaker currency to a stronger one
// It's nicer to see values greater than 1 in the notes
class Exchange {
  constructor({ fromCurrency, toCurrency }) {
    this.fromCurrency = fromCurrency;
    this.toCurrency = toCurrency;
    this.dateStart = dayjs().subtract(LOOKBACK_DAYS, "days").format("YYYY-MM-DD");
    this.dateEnd = dayjs().format("YYYY-MM-DD");
    this.rates = {};
  }

  async fetchRates() {
    // Use time series endpoint to get more bang for the API buck
    const baseUrl = "https://api.twelvedata.com/time_series?";
    const endpoint =
      baseUrl +
      `symbol=${this.toCurrency}/${this.fromCurrency}&` +
      `interval=1day&` +
      `start_date=${this.dateStart}&` +
      `end_date=${this.dateEnd}`;
    console.log(endpoint);

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: `apikey ${process.env.TWELVE_DATA_API_KEY}`,
      },
    });

    const rates = await response.json();
    for (let rate of rates.values) {
      this.rates[rate.datetime] = Number.parseFloat(rate.close);
    }
  }

  applyRate(amount, date) {
    if (date < this.dateStart || date > this.dateEnd) {
      console.warn(
        `Date ${date} is outside the range of fetched rates (${this.dateStart} to ${this.dateEnd}). ` +
        `No conversion will be applied.`
      );
      return;
    }

    let rate = this.rates[date];
    if (!rate) {
      // Fallback to the latest previous rate
      const dates = Object.keys(this.rates).toSorted();
      for (let i = dates.length - 1; i >= 0; i--) {
        if (dates[i] < date) {
          rate = this.rates[dates[i]];
          break;
        }
      }
      console.warn(
        `No rate found for ${date}, ${
          rate
            ? `falling back to previous rate ${rate}.`
            : "no previous rate found either. No conversion will be applied."
        }`
      );
    }
    if (!rate) {
      return;
    }

    // Round to the nearest cent
    return Math.round(amount / rate);
  }
}

export default Exchange;
