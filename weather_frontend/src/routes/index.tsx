import { component$, useSignal, $ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import "./styles.css";

const ENDPOINT_BASE = "/api/weather"; // Adjust to your backend's endpoint/proxy path

// Util for weather icon mapping (extend as needed)
function getWeatherIcon(code: string) {
  // OpenWeatherMap style icon codes; fallback is ☀️
  const iconMap: Record<string, string> = {
    "01d": "☀️",
    "01n": "🌙",
    "02d": "🌤️",
    "02n": "🌤️",
    "03d": "⛅",
    "03n": "⛅",
    "04d": "☁️",
    "04n": "☁️",
    "09d": "🌧️",
    "09n": "🌧️",
    "10d": "🌦️",
    "10n": "🌦️",
    "11d": "⛈️",
    "11n": "⛈️",
    "13d": "❄️",
    "13n": "❄️",
    "50d": "🌫️",
    "50n": "🌫️",
  };
  return iconMap[code] || "☀️";
}

// Types for fetched data (should match backend)
type Weather = {
  temp: number;
  weather_main: string;
  weather_desc: string;
  weather_icon: string;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  dt: number;
  city: string;
  country: string;
};

type Forecast = {
  dt: number;
  temp: number;
  weather_icon: string;
  pop?: number;
  time?: string;
  date?: string;
};

export default component$(() => {
  const location = useSignal("New York"); // default city (can be changed)
  const query = useSignal("");
  const loading = useSignal(false);
  const error = useSignal<string | null>(null);
  const current = useSignal<Weather | null>(null);
  const hourly = useSignal<Forecast[]>([]);
  const daily = useSignal<Forecast[]>([]);

  // PUBLIC_INTERFACE
  const fetchWeather = $(async (loc: string) => {
    loading.value = true;
    error.value = null;
    current.value = null;
    hourly.value = [];
    daily.value = [];
    try {
      // Backend endpoint handles both current and forecasts
      const res = await fetch(`${ENDPOINT_BASE}?q=${encodeURIComponent(loc)}`);
      if (!res.ok) {
        throw new Error("Location not found or backend error.");
      }
      const data = await res.json();
      current.value = {
        temp: Math.round(data.current.temp),
        weather_main: data.current.weather_main,
        weather_desc: data.current.weather_desc,
        weather_icon: data.current.weather_icon,
        feels_like: Math.round(data.current.feels_like),
        humidity: data.current.humidity,
        wind_speed: data.current.wind_speed,
        dt: data.current.dt,
        city: data.current.city,
        country: data.current.country,
      };
      // Process hourly: show next 6h
      hourly.value = (data.hourly || []).slice(0, 6).map((h: any) => ({
        dt: h.dt,
        temp: Math.round(h.temp),
        weather_icon: h.weather_icon,
        time: h.time,
        pop: h.pop,
      }));
      // Process daily: show next 5d
      daily.value = (data.daily || []).slice(0, 5).map((d: any) => ({
        dt: d.dt,
        temp: Math.round(d.temp),
        weather_icon: d.weather_icon,
        date: d.date,
        pop: d.pop,
      }));
    } catch (e: any) {
      error.value = e?.message || "Error fetching weather.";
    } finally {
      loading.value = false;
    }
  });

  // Fetch initial (default) city on mount
  if (!current.value && !loading.value && !error.value) {
    fetchWeather(location.value);
  }

  // --- RENDER ---
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafd" }}>
      <div class="container" style={{ maxWidth: 600, padding: "32px 16px 8px", margin: "auto" }}>
        {/* Header & Search Bar */}
        <header style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", marginBottom: 32, gap: 12
        }}>
          <h1 style={{
            margin: 0, fontWeight: 600, fontSize: "2.2rem", color: "#222",
            letterSpacing: "-1px", textAlign: "center"
          }}>
            <span style={{
              color: "#1976d2"
            }}>Weather Dashboard</span>
          </h1>
          <form
            preventdefault:submit
            style={{
              width: "100%", display: "flex", gap: 8, justifyContent: "center"
            }}
            onSubmit$={async (e) => {
              e.preventDefault();
              if (!query.value.trim()) return;
              await fetchWeather(query.value);
              location.value = query.value;
              query.value = "";
            }}
          >
            <input
              style={{
                flex: 1,
                minWidth: 0,
                maxWidth: 260,
                border: "1px solid #d3d7e1",
                borderRadius: 8,
                padding: "11px 16px",
                fontSize: 16,
                background: "#fff",
                color: "#21243d",
                outline: "none",
                transition: "border 0.2s",
              }}
              placeholder="Search location…"
              value={query.value}
              onInput$={e => (query.value = (e.target as HTMLInputElement).value)}
              aria-label="Enter city or location"
              disabled={loading.value}
            />
            <button
              type="submit"
              style={{
                border: "none",
                background: "#1976d2",
                color: "#fff",
                borderRadius: 8,
                padding: "11px 22px",
                fontWeight: 500,
                fontSize: 16,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(25, 118, 210, 0.11)",
                transition: "background 0.2s",
              }}
              disabled={loading.value}
            >
              {loading.value ? "…" : "Search"}
            </button>
          </form>
        </header>

        {/* Error UI */}
        {error.value && (
          <div
            style={{
              background: "#ffecef",
              color: "#b71c1c",
              borderRadius: 7,
              padding: "16px 20px",
              margin: "18px 0",
              textAlign: "center",
              fontSize: "1.1em",
              fontWeight: 500,
              border: "1px solid #ffdada"
            }}
          >
            {error.value}
          </div>
        )}

        {/* Current Weather Panel */}
        {current.value && !loading.value && (
          <section
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 2px 16px rgba(100,120,210,0.09)",
              padding: "30px 18px 18px",
              marginBottom: 30,
              minHeight: 190,
              position: "relative",
            }}
          >
            <div style={{
              position: "absolute", left: 20, top: 20, color: "#3a5c9c", fontWeight: 600, fontSize: "1rem"
            }}>
              {current.value.city}, {current.value.country}
            </div>
            <div style={{
              fontSize: "3.8rem", fontWeight: 700, color: "#1976d2", marginTop: 14,
              lineHeight: "3.5rem"
            }}>
              {getWeatherIcon(current.value.weather_icon)} {current.value.temp}°
            </div>
            <div style={{
              fontWeight: 500, color: "#424242", fontSize: "1.3em", marginTop: 5,
              letterSpacing: "-0.5px"
            }}>
              {current.value.weather_main} ({current.value.weather_desc})
            </div>
            <div style={{display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap", fontSize: "1em", justifyContent: "center", color: "#385080"}}>
              <span>💧 Humidity: <b>{current.value.humidity}%</b></span>
              <span>🌬️ Wind: <b>{current.value.wind_speed} m/s</b></span>
              <span>🌡️ Feels like: <b>{current.value.feels_like}°</b></span>
            </div>
          </section>
        )}

        {/* Forecast Grid */}
        {(hourly.value.length || daily.value.length) && !loading.value && (
          <section style={{ marginBottom: 24 }}>
            {/* Hourly Forecast */}
            {hourly.value.length > 0 && (
              <>
                <h2 style={{
                  fontSize: "1.2em", color: "#1976d2", marginBottom: 7, marginTop: 0, fontWeight: 600,
                  textAlign: "left"
                }}>Next 6 Hours</h2>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6,1fr)",
                  gap: 10,
                  background: "#fff",
                  borderRadius: 13,
                  boxShadow: "0 1px 8px rgba(80,100,200,0.06)",
                  padding: "17px 8px"
                }}>
                  {hourly.value.map(h => (
                    <div style={{
                      textAlign: "center",
                      color: "#224",
                      lineHeight: 1.2,
                      padding: "2px 0"
                    }} key={h.dt}>
                      <div style={{ fontSize: 28 }}>
                        {getWeatherIcon(h.weather_icon)}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "1.1em" }}>{h.temp}°</div>
                      <div style={{
                        fontSize: 13,
                        color: "#70747c",
                        margin: "2px 0"
                      }}>
                        {h.time}
                      </div>
                      {typeof h.pop === "number" &&
                        <div style={{ fontSize: 12, color: "#9bcbe4", paddingTop: 2 }}>
                          {Math.round(h.pop * 100)}% rain
                        </div>
                      }
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Daily Forecast */}
            {daily.value.length > 0 && (
              <>
                <h2 style={{
                  fontSize: "1.2em", color: "#1976d2", marginBottom: 7, marginTop: 18, fontWeight: 600, textAlign: "left"
                }}>5-Day Forecast</h2>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: 13,
                  background: "#fff",
                  borderRadius: 13,
                  boxShadow: "0 1px 8px rgba(80,100,200,0.06)",
                  padding: "17px 8px"
                }}>
                  {daily.value.map(d => (
                    <div style={{
                      textAlign: "center",
                      color: "#224",
                      lineHeight: 1.35,
                      padding: "8px 0"
                    }} key={d.dt}>
                      <div style={{ fontSize: 26 }}>
                        {getWeatherIcon(d.weather_icon)}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "1.2em" }}>{d.temp}°</div>
                      <div style={{ fontSize: 13, color: "#70747c" }}>
                        {d.date}
                      </div>
                      {typeof d.pop === "number" &&
                        <div style={{ fontSize: 13, color: "#9bcbe4" }}>
                          {Math.round(d.pop * 100)}% rain
                        </div>
                      }
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* Loading spinner or state */}
        {loading.value && (
          <div style={{
            width: "100%",
            textAlign: "center",
            color: "#1976d2",
            fontSize: "1.25em",
            padding: "30px 0"
          }}>
            Loading weather...
          </div>
        )}

        {/* Attribution Footer */}
        <footer style={{
          color: "#777a88",
          fontSize: 14,
          marginTop: 42,
          textAlign: "center",
        }}>
          Powered by <a href="https://openweathermap.org/" target="_blank" style={{
            color: "#1976d2", fontWeight: 600, textDecoration: "underline"
          }}>OpenWeatherMap</a>. Built with Qwik.
        </footer>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Weather Dashboard",
  meta: [
    { name: "description", content: "Ultra-fast weather dashboard built with Qwik and FastAPI" },
  ],
};
