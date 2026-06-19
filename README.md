# MMM-PWSCurrent

MMM-PWSCurrent is a compact MagicMirror module that shows current observations from a Weather.com / Weather Underground personal weather station.

The module fetches data server-side through `node_helper.js`, so your API key is not exposed through browser-side request code. Do not commit a real API key to a public repository.

## Installation

Place the module in your MagicMirror modules directory:

```bash
cd ~/MagicMirror/modules
git clone https://github.com/kryzbell2/MMM-PWSCurrent.git
cd MMM-PWSCurrent
```

No npm install step is required.

## Example config

Add this block to the `modules` array in `~/MagicMirror/config/config.js`:

```js
{
  module: "MMM-PWSCurrent",
  position: "top_right",
  config: {
    title: "Beech Mountain",
    stationId: "KNCBEECH91",
    apiKey: "PUT_API_KEY_HERE",
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
  }
},
```

The Weather Underground station upload key is not the same thing as the Weather.com API key used by the PWS observations API. Use the Weather.com API key for `apiKey`.

## Configuration

| Option | Default | Description |
| --- | --- | --- |
| `title` | `"Beech Mountain"` | Fallback heading shown when the API response does not include a neighborhood name. |
| `stationId` | `"KNCBEECH91"` | Personal weather station ID. |
| `apiKey` | `""` | Weather.com API key. Keep real keys out of public repos. |
| `units` | `"e"` | Weather.com units parameter. `"e"` returns imperial values. |
| `updateInterval` | `5 * 60 * 1000` | Refresh interval in milliseconds. |
| `showDetails` | `true` | Shows humidity, dew point, wind, gust, pressure, rain total, and observation time. |
| `quietHours.enabled` | `true` | Stops API pulls during the configured quiet-hours window. |
| `quietHours.start` | `"23:59"` | Local time when API pulls pause. |
| `quietHours.end` | `"05:00"` | Local time when API pulls resume. |
| `lines.<key>.label` | See example | Custom display text for each data point. |
| `lines.<key>.show` | `true` | Show or suppress individual data points. |

Use `units: "m"` to show temperature and dew point in Celsius. Wind, pressure, and rain remain displayed in imperial units.

## Checks

After installing or changing the module:

```bash
cd ~/MagicMirror/modules/MMM-PWSCurrent
node --check MMM-PWSCurrent.js
node --check node_helper.js

cd ~/MagicMirror
npm run config:check
```

Restart MagicMirror only after the config check passes:

```bash
pm2 restart MagicMirror
pm2 logs MagicMirror --lines 100
```

## Notes

The module displays `Weather unavailable` with a small diagnostic message when the API key is missing, the station ID is missing, the API returns an error, or the response does not include `observations[0]`.

If you replace MagicMirror's default weather/currentweather module, comment out the old module block in `config.js` first instead of deleting it. Back up the live config before editing:

```bash
cp ~/MagicMirror/config/config.js ~/MagicMirror/config/config.js.bak.$(date +%Y%m%d-%H%M%S)
```
