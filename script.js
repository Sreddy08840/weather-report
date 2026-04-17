// Replace with your own OpenWeather API key from https://openweathermap.org/api
// For development, create a config.js file: const OPENWEATHER_API_KEY = "your_api_key_here";
const OPENWEATHER_API_KEY = "";

const els = {
  cityInput: document.getElementById("cityInput"),
  searchBtn: document.getElementById("searchBtn"),
  geoBtn: document.getElementById("geoBtn"),
  themeToggle: document.getElementById("themeToggle"),
  unitToggle: document.getElementById("unitToggle"),
  unitLabel: document.getElementById("unitLabel"),

  error: document.getElementById("error"),
  spinner: document.getElementById("spinner"),
  current: document.getElementById("current"),

  cityName: document.getElementById("cityName"),
  condition: document.getElementById("condition"),
  icon: document.getElementById("icon"),
  temp: document.getElementById("temp"),
  tempUnit: document.getElementById("tempUnit"),
  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),
  forecastGrid: document.getElementById("forecastGrid"),
};

const state = {
  units: "metric",
  theme: "light",
  lastQuery: null, // { type: 'city'|'coords', city?, lat?, lon? }
};

function hasValidApiKey() {
  return OPENWEATHER_API_KEY && OPENWEATHER_API_KEY !== "YOUR_API_KEY";
}

function setError(message) {
  els.error.textContent = message || "";
}

function setLoading(isLoading) {
  els.spinner.hidden = !isLoading;
  els.searchBtn.disabled = isLoading;
  els.geoBtn.disabled = isLoading;
  els.cityInput.disabled = isLoading;

  if (isLoading) {
    setError("");
  }
}

function showCurrent(show) {
  els.current.hidden = !show;
}

function formatTemp(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return Math.round(value).toString();
}

function formatWind(speedMps) {
  if (typeof speedMps !== "number" || Number.isNaN(speedMps)) return "—";
  // OpenWeather returns wind speed in m/s for metric and miles/hour for imperial.
  const unit = state.units === "metric" ? "m/s" : "mph";
  return `${Math.round(speedMps)} ${unit}`;
}

function toTitleCase(s) {
  if (!s) return "";
  return s
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function getIconUrl(iconCode) {
  // OpenWeather icons
  // https://openweathermap.org/weather-conditions
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}

function setTheme(theme) {
  state.theme = theme;
  document.body.dataset.theme = theme;

  try {
    localStorage.setItem("wr_theme", theme);
  } catch {
    // ignore
  }
}

function toggleTheme() {
  setTheme(state.theme === "dark" ? "light" : "dark");
}

function setUnits(units) {
  state.units = units;
  els.unitLabel.textContent = units === "metric" ? "°C" : "°F";
  els.tempUnit.textContent = units === "metric" ? "°C" : "°F";

  try {
    localStorage.setItem("wr_units", units);
  } catch {
    // ignore
  }
}

function toggleUnits() {
  setUnits(state.units === "metric" ? "imperial" : "metric");

  // Re-fetch using the last query so all values (including forecast) match the selected unit.
  if (state.lastQuery) {
    if (state.lastQuery.type === "city") {
      fetchAndRenderByCity(state.lastQuery.city);
    } else {
      fetchAndRenderByCoords(state.lastQuery.lat, state.lastQuery.lon);
    }
  }
}

async function fetchJson(url) {
  const res = await fetch(url);

  // Current weather API often returns 404 with JSON body: { cod: '404', message: 'city not found' }
  // Treat non-2xx as an error.
  if (!res.ok) {
    let details = "";
    try {
      const body = await res.json();
      details = body?.message ? String(body.message) : "";
    } catch {
      // ignore
    }

    const msg = details ? `Request failed: ${details}` : `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return res.json();
}

function buildCurrentWeatherUrlByCity(city) {
  const q = encodeURIComponent(city.trim());
  return `https://api.openweathermap.org/data/2.5/weather?q=${q}&appid=${OPENWEATHER_API_KEY}&units=${state.units}`;
}

function buildCurrentWeatherUrlByCoords(lat, lon) {
  return `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(
    lat
  )}&lon=${encodeURIComponent(lon)}&appid=${OPENWEATHER_API_KEY}&units=${state.units}`;
}

function buildForecastUrl(lat, lon) {
  // 5-day / 3-hour forecast
  return `https://api.openweathermap.org/data/2.5/forecast?lat=${encodeURIComponent(
    lat
  )}&lon=${encodeURIComponent(lon)}&appid=${OPENWEATHER_API_KEY}&units=${state.units}`;
}

function pickDailyMiddaySnapshots(list) {
  // The forecast endpoint returns 3-hourly data for 5 days.
  // We pick one snapshot around 12:00 local time each day (fallback to nearest).
  const byDate = new Map();

  for (const item of list || []) {
    if (!item?.dt_txt) continue;
    const [date, time] = item.dt_txt.split(" ");
    if (!date || !time) continue;

    // Only consider points roughly around midday.
    const hour = Number(time.slice(0, 2));
    const score = Math.abs(hour - 12);

    if (!byDate.has(date) || score < byDate.get(date).score) {
      byDate.set(date, { score, item });
    }
  }

  // Keep only the next 5 unique days.
  return Array.from(byDate.values())
    .map((v) => v.item)
    .slice(0, 5);
}

function formatDowFromDt(dtSeconds) {
  const d = new Date(dtSeconds * 1000);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function renderForecast(forecastList) {
  els.forecastGrid.innerHTML = "";

  const items = pickDailyMiddaySnapshots(forecastList);
  for (const item of items) {
    const dow = formatDowFromDt(item.dt);
    const iconCode = item?.weather?.[0]?.icon;
    const desc = toTitleCase(item?.weather?.[0]?.description || "");
    const temp = formatTemp(item?.main?.temp);

    const card = document.createElement("div");
    card.className = "day";

    const title = document.createElement("div");
    title.className = "day__dow";
    title.textContent = dow;

    const img = document.createElement("img");
    img.className = "day__icon";
    img.alt = desc ? `Forecast: ${desc}` : "Forecast icon";
    if (iconCode) img.src = getIconUrl(iconCode);

    const t = document.createElement("div");
    t.className = "day__temp";
    t.textContent = `${temp}${state.units === "metric" ? "°C" : "°F"}`;

    const d = document.createElement("div");
    d.className = "day__desc";
    d.textContent = desc || "—";

    card.append(title, img, t, d);
    els.forecastGrid.appendChild(card);
  }
}

function renderCurrent(weather) {
  const city = `${weather?.name || ""}${weather?.sys?.country ? `, ${weather.sys.country}` : ""}`;
  const condition = toTitleCase(weather?.weather?.[0]?.description || "");
  const iconCode = weather?.weather?.[0]?.icon;

  els.cityName.textContent = city || "—";
  els.condition.textContent = condition || "—";

  if (iconCode) {
    els.icon.src = getIconUrl(iconCode);
    els.icon.alt = condition ? `Current weather: ${condition}` : "Current weather";
  } else {
    els.icon.removeAttribute("src");
    els.icon.alt = "";
  }

  els.temp.textContent = formatTemp(weather?.main?.temp);
  els.humidity.textContent =
    typeof weather?.main?.humidity === "number" ? `${weather.main.humidity}%` : "—";
  els.wind.textContent = formatWind(weather?.wind?.speed);
}

async function fetchAndRenderByCity(city) {
  const cleaned = (city || "").trim();
  if (!cleaned) {
    setError("Please enter a city name.");
    showCurrent(false);
    return;
  }

  if (!hasValidApiKey()) {
    setError("Add your OpenWeather API key in script.js (OPENWEATHER_API_KEY). ");
    showCurrent(false);
    return;
  }

  setLoading(true);
  showCurrent(false);

  try {
    state.lastQuery = { type: "city", city: cleaned };

    const currentUrl = buildCurrentWeatherUrlByCity(cleaned);
    const current = await fetchJson(currentUrl);

    const lat = current?.coord?.lat;
    const lon = current?.coord?.lon;

    renderCurrent(current);

    if (typeof lat === "number" && typeof lon === "number") {
      const forecastUrl = buildForecastUrl(lat, lon);
      const forecast = await fetchJson(forecastUrl);
      renderForecast(forecast?.list || []);
    } else {
      els.forecastGrid.innerHTML = "";
    }

    showCurrent(true);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";

    if (/city not found/i.test(msg)) {
      setError("City not found. Please check the spelling and try again.");
    } else {
      setError(msg);
    }

    showCurrent(false);
  } finally {
    setLoading(false);
  }
}

async function fetchAndRenderByCoords(lat, lon) {
  if (!hasValidApiKey()) {
    setError("Add your OpenWeather API key in script.js (OPENWEATHER_API_KEY). ");
    showCurrent(false);
    return;
  }

  setLoading(true);
  showCurrent(false);

  try {
    state.lastQuery = { type: "coords", lat, lon };

    const currentUrl = buildCurrentWeatherUrlByCoords(lat, lon);
    const current = await fetchJson(currentUrl);
    renderCurrent(current);

    const forecastUrl = buildForecastUrl(lat, lon);
    const forecast = await fetchJson(forecastUrl);
    renderForecast(forecast?.list || []);

    showCurrent(true);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    setError(msg);
    showCurrent(false);
  } finally {
    setLoading(false);
  }
}

function detectLocation() {
  if (!navigator.geolocation) {
    setError("Geolocation is not supported by your browser.");
    return;
  }

  setError("");
  setLoading(true);

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos?.coords?.latitude;
      const lon = pos?.coords?.longitude;

      if (typeof lat !== "number" || typeof lon !== "number") {
        setLoading(false);
        setError("Could not read your location. Please try again.");
        return;
      }

      await fetchAndRenderByCoords(lat, lon);
    },
    (err) => {
      setLoading(false);

      // Helpful messages for common cases
      if (err?.code === 1) {
        setError("Location permission denied. You can still search by city.");
      } else if (err?.code === 2) {
        setError("Location unavailable. Please try again or search by city.");
      } else {
        setError("Unable to fetch location. Please try again.");
      }
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
}

function restorePrefs() {
  try {
    const theme = localStorage.getItem("wr_theme");
    const units = localStorage.getItem("wr_units");

    if (theme === "dark" || theme === "light") setTheme(theme);
    else {
      // Prefer OS theme if no saved preference
      const prefersDark =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    }

    if (units === "metric" || units === "imperial") setUnits(units);
    else setUnits("metric");
  } catch {
    setTheme("light");
    setUnits("metric");
  }
}

function bindEvents() {
  els.searchBtn.addEventListener("click", () => {
    fetchAndRenderByCity(els.cityInput.value);
  });

  els.cityInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      fetchAndRenderByCity(els.cityInput.value);
    }
  });

  els.geoBtn.addEventListener("click", () => {
    detectLocation();
  });

  els.themeToggle.addEventListener("click", () => {
    toggleTheme();
  });

  els.unitToggle.addEventListener("click", () => {
    toggleUnits();
  });
}

// 3D Tilt Effect on Mouse Move
function enable3DTilt() {
  const card = document.querySelector(".card");
  const app = document.querySelector(".app");
  
  if (!card) return;

  document.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate angle from center
    const angleX = (e.clientY - centerY) / rect.height * 5; // Max 5 degrees
    const angleY = (centerX - e.clientX) / rect.width * 5;
    
    // Apply 3D perspective transform
    card.style.transform = `perspective(1200px) rotateX(${angleX}deg) rotateY(${angleY}deg) translateZ(20px)`;
  });

  // Reset on mouse leave
  card.addEventListener("mouseleave", () => {
    card.style.transform = "perspective(1200px) rotateX(0) rotateY(0) translateZ(0)";
  });
}

function init() {
  restorePrefs();
  bindEvents();
  enable3DTilt();

  // Optional: try geolocation once at start for a nicer first-load experience
  // (only if a key exists, otherwise it would show an error message).
  if (hasValidApiKey()) {
    // Do not auto-trigger permission prompt; only fetch if permission was already granted.
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((res) => {
          if (res.state === "granted") detectLocation();
        })
        .catch(() => {
          // ignore
        });
    }
  }
}

init();
