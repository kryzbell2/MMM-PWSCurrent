/* global Module */

Module.register("MMM-PWSCurrent", {
  defaults: {
    title: "Beech Mountain",
    stationId: "KNCBEECH91",
    apiKey: "",
    units: "e",
    updateInterval: 5 * 60 * 1000,
    showDetails: true,
    quietHours: {
      enabled: true,
      start: "23:59",
      end: "05:00"
    },
    lines: {
      temperature: { label: "Temperature", show: true },
      humidity: { label: "Humidity", show: true },
      dewPoint: { label: "Dew point", show: true },
      windSpeed: { label: "Wind", show: true },
      windGust: { label: "Gust", show: true },
      pressure: { label: "Pressure", show: true },
      rainTotal: { label: "Rain", show: true },
      obsTimeLocal: { label: "Observed", show: true }
    }
  },

  start: function () {
    this.loaded = false;
    this.weather = null;
    this.error = null;
    this.paused = false;
    this.timer = null;

    this.sendSocketNotification("PWS_CONFIG", this.config);
    this.scheduleUpdate();
  },

  getStyles: function () {
    return ["MMM-PWSCurrent.css"];
  },

  scheduleUpdate: function () {
    var self = this;
    var interval = Math.max(Number(this.config.updateInterval) || this.defaults.updateInterval, 60 * 1000);

    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(function () {
      self.sendSocketNotification("PWS_REFRESH");
    }, interval);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "PWS_DATA") {
      this.loaded = true;
      this.weather = payload;
      this.error = null;
      this.paused = false;
      this.updateDom(400);
    }

    if (notification === "PWS_ERROR") {
      this.loaded = true;
      this.error = payload || { message: "Unknown error" };
      this.paused = false;
      this.updateDom(400);
    }

    if (notification === "PWS_PAUSED") {
      this.loaded = true;
      this.error = payload || { message: "Weather updates paused" };
      this.paused = true;
      this.updateDom(400);
    }
  },

  getDom: function () {
    var wrapper = document.createElement("div");
    wrapper.className = "mmm-pws-current";

    var title = document.createElement("div");
    title.className = "pws-title small dimmed";
    title.innerHTML = this.escapeHtml(this.getTitle());
    wrapper.appendChild(title);

    if (!this.loaded) {
      wrapper.appendChild(this.makeStatus("Loading weather..."));
      return wrapper;
    }

    if (this.error) {
      if (this.paused) {
        wrapper.appendChild(this.makeStatus(this.error.message || "Weather updates paused", this.error.diagnostic));
      } else {
        wrapper.appendChild(this.makeStatus("Weather unavailable", this.error.diagnostic || this.error.message || this.error.code));
      }
      return wrapper;
    }

    if (!this.weather) {
      wrapper.appendChild(this.makeStatus("Weather unavailable", "No observation data returned"));
      return wrapper;
    }

    if (this.isRowVisible("temperature") || this.isRowVisible("humidity")) {
      var current = document.createElement("div");
      current.className = "pws-current-row";

      if (this.isRowVisible("temperature")) {
        var temp = document.createElement("span");
        temp.className = "pws-temp bright";
        temp.innerHTML = this.formatValue(this.weather.temperature, this.getUnitLabels().temperature);
        current.appendChild(temp);
      }

      if (this.isRowVisible("humidity")) {
        var humidity = document.createElement("span");
        humidity.className = "pws-humidity small dimmed";
        humidity.innerHTML = this.formatValue(this.weather.humidity, "% " + this.getRowLabel("humidity").toLowerCase());
        current.appendChild(humidity);
      }

      wrapper.appendChild(current);
    }

    if (this.config.showDetails) {
      wrapper.appendChild(this.makeDetailsTable());
    }

    if (this.weather.obsTimeLocal && this.isRowVisible("obsTimeLocal")) {
      var observed = document.createElement("div");
      observed.className = "pws-observed xsmall dimmed";
      observed.innerHTML = this.escapeHtml(this.getRowLabel("obsTimeLocal")) + " " + this.escapeHtml(this.weather.obsTimeLocal);
      wrapper.appendChild(observed);
    }

    return wrapper;
  },

  makeDetailsTable: function () {
    var table = document.createElement("table");
    table.className = "pws-details small";
    var units = this.getUnitLabels();

    var rows = [
      ["dewPoint", this.formatValue(this.weather.dewPoint, units.temperature)],
      ["windSpeed", this.formatValue(this.weather.windSpeed, units.windSpeed)],
      ["windGust", this.formatValue(this.weather.windGust, units.windSpeed)],
      ["pressure", this.formatValue(this.weather.pressure, units.pressure)],
      ["rainTotal", this.formatValue(this.weather.rainTotal, units.rain)]
    ];

    for (var i = 0; i < rows.length; i += 1) {
      if (!this.isRowVisible(rows[i][0])) {
        continue;
      }

      var tr = document.createElement("tr");
      var label = document.createElement("td");
      var value = document.createElement("td");

      label.className = "pws-label dimmed";
      value.className = "pws-value bright";
      label.innerHTML = this.escapeHtml(this.getRowLabel(rows[i][0]));
      value.innerHTML = rows[i][1];

      tr.appendChild(label);
      tr.appendChild(value);
      table.appendChild(tr);
    }

    return table;
  },

  getRowLabel: function (key) {
    if (this.config.lines && this.config.lines[key] && this.config.lines[key].label !== undefined) {
      return this.config.lines[key].label;
    }

    if (this.config.labels && this.config.labels[key] !== undefined) {
      return this.config.labels[key];
    }

    if (this.defaults.lines[key] && this.defaults.lines[key].label !== undefined) {
      return this.defaults.lines[key].label;
    }

    return key;
  },

  isRowVisible: function (key) {
    if (this.config.lines && this.config.lines[key] && this.config.lines[key].show !== undefined) {
      return Boolean(this.config.lines[key].show);
    }

    if (this.config.showRows && this.config.showRows[key] !== undefined) {
      return Boolean(this.config.showRows[key]);
    }

    if (this.defaults.lines[key] && this.defaults.lines[key].show !== undefined) {
      return Boolean(this.defaults.lines[key].show);
    }

    return true;
  },

  getUnitLabels: function () {
    if (this.config.units === "m") {
      return {
        temperature: "&deg;C",
        windSpeed: "mph",
        pressure: "in",
        rain: "in"
      };
    }

    return {
      temperature: "&deg;F",
      windSpeed: "mph",
      pressure: "in",
      rain: "in"
    };
  },

  makeStatus: function (message, diagnostic) {
    var status = document.createElement("div");
    status.className = "pws-status";

    var main = document.createElement("div");
    main.className = "small bright";
    main.innerHTML = this.escapeHtml(message);
    status.appendChild(main);

    if (diagnostic) {
      var detail = document.createElement("div");
      detail.className = "xsmall dimmed pws-diagnostic";
      detail.innerHTML = this.escapeHtml(String(diagnostic));
      status.appendChild(detail);
    }

    return status;
  },

  getTitle: function () {
    if (this.weather && this.weather.neighborhood) {
      return this.weather.neighborhood;
    }

    return this.config.title || this.config.stationId || "Current Weather";
  },

  formatValue: function (value, suffix) {
    if (value === null || value === undefined || value === "") {
      return "--";
    }

    if (typeof value === "number") {
      return this.escapeHtml(this.formatNumber(value)) + (suffix ? " " + suffix : "");
    }

    return this.escapeHtml(String(value)) + (suffix ? " " + suffix : "");
  },

  formatNumber: function (value) {
    if (Math.abs(value) >= 100) {
      return value.toFixed(0);
    }

    if (Math.abs(value) >= 10) {
      return value.toFixed(1).replace(/\.0$/, "");
    }

    return value.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
  },

  escapeHtml: function (value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
