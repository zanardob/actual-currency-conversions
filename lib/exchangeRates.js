import dayjs from "dayjs";

const LOOKBACK_DAYS = 365;

// Uses inverted rates because we're usually converting from a weaker currency to a stronger one
// It's nicer to see values greater than 1 in the notes
function createExchange({ fromCurrency, toCurrency }) {
  const dateStart = dayjs().subtract(LOOKBACK_DAYS, "days").format("YYYY-MM-DD");
  const dateEnd = dayjs().format("YYYY-MM-DD");
  let rates = {};

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
