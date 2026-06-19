/* global Module */

Module.register("MMM-PWSCurrent", {
  defaults: {
    title: "Beech Mountain",
    stationId: "KNCBEECH91",
    apiKey: "",
    units: "e",
    updateInterval: 5 * 60 * 1000,
    showDetails: true
  },

  start: function () {
    this.loaded = false;
    this.weather = null;
    this.error = null;
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
      this.updateDom(400);
    }

    if (notification === "PWS_ERROR") {
      this.loaded = true;
      this.error = payload || { message: "Unknown error" };
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
      wrapper.appendChild(this.makeStatus("Weather unavailable", this.error.message || this.error.code));
      return wrapper;
    }

    if (!this.weather) {
      wrapper.appendChild(this.makeStatus("Weather unavailable", "No observation data returned"));
      return wrapper;
    }

    var current = document.createElement("div");
    current.className = "pws-current-row";

    var temp = document.createElement("span");
    temp.className = "pws-temp bright";
    temp.innerHTML = this.formatValue(this.weather.temperature, "&deg;F");
    current.appendChild(temp);

    var humidity = document.createElement("span");
    humidity.className = "pws-humidity small dimmed";
    humidity.innerHTML = this.formatValue(this.weather.humidity, "% humidity");
    current.appendChild(humidity);

    wrapper.appendChild(current);

    if (this.config.showDetails) {
      wrapper.appendChild(this.makeDetailsTable());
    }

    if (this.weather.obsTimeLocal) {
      var observed = document.createElement("div");
      observed.className = "pws-observed xsmall dimmed";
      observed.innerHTML = "Observed " + this.escapeHtml(this.weather.obsTimeLocal);
      wrapper.appendChild(observed);
    }

    return wrapper;
  },

  makeDetailsTable: function () {
    var table = document.createElement("table");
    table.className = "pws-details small";

    var rows = [
      ["Dew point", this.formatValue(this.weather.dewPoint, "&deg;F")],
      ["Wind", this.formatValue(this.weather.windSpeed, "mph")],
      ["Gust", this.formatValue(this.weather.windGust, "mph")],
      ["Pressure", this.formatValue(this.weather.pressure, "in")],
      ["Rain", this.formatValue(this.weather.rainTotal, "in")]
    ];

    for (var i = 0; i < rows.length; i += 1) {
      var tr = document.createElement("tr");
      var label = document.createElement("td");
      var value = document.createElement("td");

      label.className = "pws-label dimmed";
      value.className = "pws-value bright";
      label.innerHTML = rows[i][0];
      value.innerHTML = rows[i][1];

      tr.appendChild(label);
      tr.appendChild(value);
      table.appendChild(tr);
    }

    return table;
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
