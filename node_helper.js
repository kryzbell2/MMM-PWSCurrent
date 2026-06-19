var NodeHelper = require("node_helper");
var Log = require("logger");
var https = require("https");

module.exports = NodeHelper.create({
  start: function () {
    this.config = null;
    this.isFetching = false;
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "PWS_CONFIG") {
      this.config = Object.assign({}, payload);
      this.fetchWeather();
    }

    if (notification === "PWS_REFRESH") {
      this.fetchWeather();
    }
  },

  fetchWeather: function () {
    var self = this;

    if (!this.config) {
      this.sendError("Missing module config");
      return;
    }

    if (!this.config.apiKey) {
      this.sendError("Missing Weather.com API key");
      return;
    }

    if (!this.config.stationId) {
      this.sendError("Missing PWS station ID");
      return;
    }

    if (this.isFetching) {
      return;
    }

    this.isFetching = true;

    this.getJson(this.buildUrl(this.config))
      .then(function (data) {
        var observation = self.getObservation(data);
        self.sendSocketNotification("PWS_DATA", self.normalizeObservation(observation));
      })
      .catch(function (error) {
        Log.error("MMM-PWSCurrent: " + error.message);
        self.sendError(error.message);
      })
      .finally(function () {
        self.isFetching = false;
      });
  },

  buildUrl: function (config) {
    var stationId = encodeURIComponent(config.stationId);
    var units = encodeURIComponent(config.units || "e");
    var apiKey = encodeURIComponent(config.apiKey);

    return "https://api.weather.com/v2/pws/observations/current" +
      "?stationId=" + stationId +
      "&format=json" +
      "&units=" + units +
      "&apiKey=" + apiKey;
  },

  getJson: function (url) {
    return new Promise(function (resolve, reject) {
      var request = https.get(url, { timeout: 15000 }, function (response) {
        var body = "";

        response.setEncoding("utf8");
        response.on("data", function (chunk) {
          body += chunk;
        });
        response.on("end", function () {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error("Weather API returned HTTP " + response.statusCode));
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error("Weather API returned invalid JSON"));
          }
        });
      });

      request.on("timeout", function () {
        request.destroy(new Error("Weather API request timed out"));
      });
      request.on("error", reject);
    });
  },

  getObservation: function (data) {
    if (!data || !Array.isArray(data.observations) || !data.observations[0]) {
      throw new Error("Weather API response did not include observations[0]");
    }

    return data.observations[0];
  },

  normalizeObservation: function (observation) {
    var values = observation.imperial || observation.metric || {};

    return {
      stationId: observation.stationID || observation.stationId || null,
      neighborhood: observation.neighborhood || null,
      obsTimeLocal: observation.obsTimeLocal || null,
      humidity: this.numberOrNull(observation.humidity),
      temperature: this.numberOrNull(values.temp),
      dewPoint: this.numberOrNull(values.dewpt),
      windSpeed: this.numberOrNull(values.windSpeed),
      windGust: this.numberOrNull(values.windGust),
      pressure: this.numberOrNull(values.pressure),
      rainTotal: this.numberOrNull(values.precipTotal)
    };
  },

  numberOrNull: function (value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  },

  sendError: function (message) {
    this.sendSocketNotification("PWS_ERROR", {
      message: message || "Weather unavailable"
    });
  }
});
