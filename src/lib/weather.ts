/**
 * Open-Meteo forecast client.
 *
 *   https://open-meteo.com/en/docs
 *
 * Free, no API key, generous limits. Fits the self-hosted ethos: just an
 * HTTP fetch with no signup. Hourly forecasts up to 16 days out, which
 * comfortably covers the 14-day rides window.
 *
 * Cached via Next.js fetch revalidate (1h) so 14 ride list cards don't
 * hammer Open-Meteo on every page load.
 */

export type RideForecast = {
  temperatureC: number;
  windKph: number;
  precipMm: number;
  precipChancePct: number;
  weatherCode: number;
  /** Local time at the start point, "HH:MM" — only set if available */
  sunriseLocal?: string;
  sunsetLocal?: string;
};

export const WIND_THRESHOLD_KPH = 20;

// WMO weather code → emoji + human label
// Reference: https://open-meteo.com/en/docs (Weather variables documentation)
const WMO: Record<number, { icon: string; label: string }> = {
  0:  { icon: "☀️", label: "Clear" },
  1:  { icon: "🌤️", label: "Mainly clear" },
  2:  { icon: "⛅", label: "Partly cloudy" },
  3:  { icon: "☁️", label: "Overcast" },
  45: { icon: "🌫️", label: "Fog" },
  48: { icon: "🌫️", label: "Fog" },
  51: { icon: "🌦️", label: "Light drizzle" },
  53: { icon: "🌦️", label: "Drizzle" },
  55: { icon: "🌦️", label: "Heavy drizzle" },
  56: { icon: "🌧️", label: "Freezing drizzle" },
  57: { icon: "🌧️", label: "Freezing drizzle" },
  61: { icon: "🌧️", label: "Light rain" },
  63: { icon: "🌧️", label: "Rain" },
  65: { icon: "⛈️", label: "Heavy rain" },
  66: { icon: "🌧️", label: "Freezing rain" },
  67: { icon: "🌧️", label: "Freezing rain" },
  71: { icon: "🌨️", label: "Light snow" },
  73: { icon: "🌨️", label: "Snow" },
  75: { icon: "❄️", label: "Heavy snow" },
  77: { icon: "🌨️", label: "Snow grains" },
  80: { icon: "🌦️", label: "Showers" },
  81: { icon: "🌧️", label: "Showers" },
  82: { icon: "⛈️", label: "Heavy showers" },
  85: { icon: "🌨️", label: "Snow showers" },
  86: { icon: "🌨️", label: "Snow showers" },
  95: { icon: "⛈️", label: "Thunderstorm" },
  96: { icon: "⛈️", label: "Storm + hail" },
  99: { icon: "⛈️", label: "Storm + hail" },
};

export function weatherIcon(code: number) {
  return WMO[code] ?? { icon: "🌡️", label: "Forecast" };
}

const FORECAST_HORIZON_DAYS = 16;

type OpenMeteoResponse = {
  utc_offset_seconds?: number;
  hourly?: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    precipitation: number[];
    weather_code: number[];
    wind_speed_10m: number[];
  };
  daily?: {
    time: string[];
    sunrise: string[];
    sunset: string[];
  };
};

/**
 * Fetch the forecast for a ride at lat/lng on date `at`. Returns null when:
 *   - the date is in the past
 *   - the date is more than ~16 days out (Open-Meteo's horizon)
 *   - the API call fails for any reason
 *
 * On null, callers should render no forecast UI — graceful degradation.
 */
export async function getRideForecast(
  lat: number,
  lng: number,
  at: Date,
): Promise<RideForecast | null> {
  const now = Date.now();
  const target = at.getTime();
  if (!Number.isFinite(target) || target < now) return null;
  const daysOut = (target - now) / 86_400_000;
  if (daysOut > FORECAST_HORIZON_DAYS) return null;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toFixed(3));
  url.searchParams.set("longitude", lng.toFixed(3));
  url.searchParams.set(
    "hourly",
    "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m",
  );
  url.searchParams.set("daily", "sunrise,sunset");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", String(Math.max(1, Math.ceil(daysOut) + 1)));

  let data: OpenMeteoResponse;
  try {
    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    data = await res.json();
  } catch {
    return null;
  }

  if (!data.hourly?.time?.length) return null;

  // Open-Meteo returns hourly.time and daily.sunrise as location-local
  // strings ("YYYY-MM-DDTHH:MM") with an associated utc_offset_seconds.
  // Compute the local-time prefix of `at` at the location, then find the
  // matching hour in the response.
  const offsetMs = (data.utc_offset_seconds ?? 0) * 1000;
  const shifted = new Date(target + offsetMs);
  const Y = shifted.getUTCFullYear();
  const M = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const D = String(shifted.getUTCDate()).padStart(2, "0");
  const H = String(shifted.getUTCHours()).padStart(2, "0");
  const localPrefix = `${Y}-${M}-${D}T${H}`;

  const idx = data.hourly.time.findIndex((t) => t.startsWith(localPrefix));
  if (idx === -1) return null;

  // Same date in daily array — match by date prefix
  const dayPrefix = `${Y}-${M}-${D}`;
  const dayIdx = data.daily?.time?.findIndex((t) => t.startsWith(dayPrefix)) ?? -1;
  const sunriseLocal =
    dayIdx >= 0 ? data.daily?.sunrise?.[dayIdx]?.slice(11, 16) : undefined;
  const sunsetLocal =
    dayIdx >= 0 ? data.daily?.sunset?.[dayIdx]?.slice(11, 16) : undefined;

  return {
    temperatureC: data.hourly.temperature_2m[idx],
    windKph: data.hourly.wind_speed_10m[idx],
    precipMm: data.hourly.precipitation[idx],
    precipChancePct: data.hourly.precipitation_probability[idx],
    weatherCode: data.hourly.weather_code[idx],
    sunriseLocal,
    sunsetLocal,
  };
}
