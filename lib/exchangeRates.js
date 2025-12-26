import dayjs from "dayjs";

/**
 * @typedef {Object} ExchangeOptions
 * @property {string} fromCurrency - ISO4217 currency code to convert from
 * @property {string} toCurrency - ISO4217 currency code to convert to
 */

/**
 * @typedef {Object} ConversionResult
 * @property {number} [amount] - Converted amount in cents, rounded
 * @property {number} [rate] - Exchange rate used for conversion
 */

/**
 * @typedef {Object} Exchange
 * @property {string} fromCurrency - Source currency code
 * @property {string} toCurrency - Target currency code
 * @property {() => Promise<void>} fetchRates - Fetches exchange rates from the API
 * @property {(amount: number, date: string) => ConversionResult} applyRate - Converts an amount using the rate for a given date
 */

const LOOKBACK_DAYS = 365;

/**
 * Creates an exchange rate converter that fetches and applies historical rates.
 * Uses inverted rates because we're usually converting from a weaker currency to a stronger one.
 * It's nicer to see values greater than 1 in the notes.
 * @param {ExchangeOptions} options - Currency pair configuration
 * @returns {Exchange} Exchange instance with fetchRates and applyRate methods
 */
function createExchange({ fromCurrency, toCurrency }) {
  const dateStart = dayjs().subtract(LOOKBACK_DAYS, "days").format("YYYY-MM-DD");
  const dateEnd = dayjs().format("YYYY-MM-DD");
  /** @type {Record<string, number>} */
  let rates = {};

  /**
   * Fetches historical exchange rates from the Twelve Data API.
   * @returns {Promise<void>}
   */
  async function fetchRates() {
    // Use time series endpoint to get more bang for the API buck
    const baseUrl = "https://api.twelvedata.com/time_series?";
    const endpoint =
      baseUrl +
      `symbol=${toCurrency}/${fromCurrency}&` +
      `interval=1day&` +
      `start_date=${dateStart}&` +
      `end_date=${dateEnd}`;
    console.log(endpoint);

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: `apikey ${process.env.TWELVE_DATA_API_KEY}`,
      },
    });

    const data = await response.json();
    for (let rate of data.values) {
      rates[rate.datetime] = Number.parseFloat(rate.close);
    }
  }

  /**
   * Applies the exchange rate for a given date to convert an amount.
   * Falls back to the latest previous rate if no rate exists for the exact date.
   * @param {number} amount - Amount in cents to convert
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {ConversionResult} Converted amount and rate used, or empty object if conversion failed
   */
  function applyRate(amount, date) {
    if (date < dateStart || date > dateEnd) {
      console.warn(
        `Date ${date} is outside the range of fetched rates (${dateStart} to ${dateEnd}). ` +
        `No conversion will be applied.`
      );
      return {};
    }

    let rate = rates[date];
    if (!rate) {
      // Fallback to the latest previous rate
      const dates = Object.keys(rates).toSorted();
      for (let i = dates.length - 1; i >= 0; i--) {
        if (dates[i] < date) {
          rate = rates[dates[i]];
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
      return {};
    }

    // Round to the nearest cent
    // Also return the rate used
    return { amount: Math.round(amount / rate), rate };
  }

  return {
    fromCurrency,
    toCurrency,
    fetchRates,
    applyRate,
  };
}

export default createExchange;
