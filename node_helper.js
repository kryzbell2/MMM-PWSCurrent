var NodeHelper = require("node_helper");
var Log = require("logger");
var https = require("https");

module.exports = NodeHelper.create({
  start: function () {
    this.config = null;
    this.isFetching = false;
    this.lastObservation = null;
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

    if (this.isQuietHours(this.config)) {
      if (this.lastObservation) {
        this.sendSocketNotification("PWS_DATA", Object.assign({}, this.lastObservation, {
          paused: true,
          stale: true
        }));
        return;
      }

      this.sendSocketNotification("PWS_PAUSED", {
        message: "Weather updates paused",
        diagnostic: "Next fetch after " + this.getQuietEnd(this.config)
      });
      return;
    }

    this.isFetching = true;

    this.getJson(this.buildUrl(this.config))
      .then(function (data) {
        var observation = self.getObservation(data);
        self.lastObservation = self.normalizeObservation(observation);
        self.sendSocketNotification("PWS_DATA", self.lastObservation);
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
    var imperial = observation.imperial || {};
    var metric = observation.metric || {};
    var temperatureValues = this.config && this.config.units === "m" ? metric : imperial;

    return {
      stationId: observation.stationID || observation.stationId || null,
      neighborhood: observation.neighborhood || null,
      obsTimeLocal: observation.obsTimeLocal || null,
      humidity: this.numberOrNull(observation.humidity),
      temperature: this.normalizeTemperature(temperatureValues.temp, imperial.temp),
      dewPoint: this.normalizeTemperature(temperatureValues.dewpt, imperial.dewpt),
      windSpeed: this.normalizeMph(imperial.windSpeed, metric.windSpeed),
      windGust: this.normalizeMph(imperial.windGust, metric.windGust),
      pressure: this.normalizeInHg(imperial.pressure, metric.pressure),
      rainTotal: this.normalizeInches(imperial.precipTotal, metric.precipTotal)
    };
  },

  normalizeTemperature: function (preferredValue, fallbackImperialValue) {
    var preferred = this.numberOrNull(preferredValue);

    if (preferred !== null) {
      return preferred;
    }

    var fahrenheit = this.numberOrNull(fallbackImperialValue);

    if (fahrenheit === null) {
      return null;
    }

    if (this.config && this.config.units === "m") {
      return (fahrenheit - 32) * 5 / 9;
    }

    return fahrenheit;
  },

  normalizeMph: function (imperialValue, metricValue) {
    var mph = this.numberOrNull(imperialValue);

    if (mph !== null) {
      return mph;
    }

    var kilometersPerHour = this.numberOrNull(metricValue);
    return kilometersPerHour === null ? null : kilometersPerHour * 0.621371;
  },

  normalizeInHg: function (imperialValue, metricValue) {
    var inches = this.numberOrNull(imperialValue);

    if (inches !== null) {
      return inches;
    }

    var hectopascals = this.numberOrNull(metricValue);
    return hectopascals === null ? null : hectopascals * 0.029529983071445;
  },

  normalizeInches: function (imperialValue, metricValue) {
    var inches = this.numberOrNull(imperialValue);

    if (inches !== null) {
      return inches;
    }

    var millimeters = this.numberOrNull(metricValue);
    return millimeters === null ? null : millimeters * 0.039370078740157;
  },

  isQuietHours: function (config) {
    var quietHours = config.quietHours || {};

    if (quietHours.enabled === false) {
      return false;
    }

    var start = this.timeToMinutes(quietHours.start || "23:59");
    var end = this.timeToMinutes(quietHours.end || "05:00");
    var now = new Date();
    var current = now.getHours() * 60 + now.getMinutes();

    if (start === end) {
      return false;
    }

    if (start < end) {
      return current >= start && current < end;
    }

    return current >= start || current < end;
  },

  timeToMinutes: function (time) {
    var match = String(time).match(/^(\d{1,2}):(\d{2})$/);

    if (!match) {
      return 0;
    }

    var hours = Math.min(Math.max(Number(match[1]), 0), 23);
    var minutes = Math.min(Math.max(Number(match[2]), 0), 59);

    return hours * 60 + minutes;
  },

  getQuietEnd: function (config) {
    var quietHours = config.quietHours || {};
    return quietHours.end || "05:00";
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
