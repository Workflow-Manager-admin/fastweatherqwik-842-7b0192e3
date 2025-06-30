/**
 * WEATHER DASHBOARD (Qwik)
 * Input Field Rx: city/location search bar
 * ==========================================
 * INPUT CONTROL CONTRACT:
 * - The city/location input field is a pure controlled field managed by the "query" signal.
 * - "query.value" is set ONLY by:
 *     (1) The onInput$ handler (user typing)
 *     (2) Once, on page mount, to match "location.value" if user hasn't started typing.
 * - It MUST NOT be overwritten or cleared by:
 *     - fetchWeather()
 *     - chip/city recent selection
 *     - successful/failed searches
 *     - updating current/location/recents/daily/hourly/etc.
 *     - partial/fresh/weather state changes
 * - This contract guarantees that a user can keep typing, edit, or copy/paste in the input without fear of "reset" or "stolen text" from async fetches.
 * - To reset/clear input, either have the user manually erase text or (optionally) do so ONLY on an explicit page reload/hard event.
 * 
 * Bug: If violated, users will lose their input and experience broken editing UX (see: various controlled input gotchas in web apps).
 * 
 * Maintainer Guidance: If you change state logic, always check you are NOT touching "query.value" except from user input.
 *                     See developer warning comments below in setup, search, chip click, and render.
 */

import { component$, useSignal, $, useStylesScoped$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import "./styles.css";

/**
 * Qwik Homepage: Weather Dashboard
 * - Connects to FastAPI backend via /api/weather?q=city for live current, hourly, and daily forecasts.
 * - Uses Qwik component async logic and fetch patterns.
 * - Respects proxying via /api/weather, which is handled in local dev by Vite and in deploy by the platform.
 * - Handles errors and loading states.
 * - Ensures frontend works for both local and deployed environments.
 */

// PUBLIC_INTERFACE
const ENDPOINT_BASE =
  typeof window !== "undefined"
    ? "/api/weather"
    : "/api/weather"; // For SSR-safe deployment; Vite proxy handles this in dev

const MAX_RECENTS = 6;
const COLORS = {
  primary: "#1976d2",
  background: "#f8fafd",
  card: "#fff",
  error: "#ffecef",
  errorText: "#b71c1c",
  accent: "#ffa000",
  secondary: "#424242"
};

// Utility for weather icon mapping (OpenWeatherMap style)
function getWeatherIcon(code: string) {
  const iconMap: Record<string, string> = {
    "01d": "☀️", "01n": "🌙", "02d": "🌤️", "02n": "🌤️", "03d": "⛅", "03n": "⛅",
    "04d": "☁️", "04n": "☁️", "09d": "🌧️", "09n": "🌧️", "10d": "🌦️", "10n": "🌦️",
    "11d": "⛈️", "11n": "⛈️", "13d": "❄️", "13n": "❄️", "50d": "🌫️", "50n": "🌫️"
  };
  return iconMap[code] || "☀️";
}

// Types for fetched data
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

// --- RECENT SEARCHES (localStorage and sync) ---
function saveRecent(name: string) {
  let arr: string[] = [];
  try {
    arr = JSON.parse(localStorage.getItem("recent_cities") || "[]");
  } catch { arr = []; }
  if (!arr.includes(name)) arr.unshift(name);
  arr = arr.slice(0, MAX_RECENTS);
  localStorage.setItem("recent_cities", JSON.stringify(arr));
}
function loadRecents(): string[] {
  try {
    return JSON.parse(localStorage.getItem("recent_cities") || "[]");
  } catch {
    return [];
  }
}

// --- MAIN COMPONENT ---
export default component$(() => {
  useStylesScoped$(`
    .chip-row {
      display: flex; flex-wrap: wrap; gap: 9px; margin-bottom: 18px; justify-content: center;
    }
    .chip {
      padding: 6px 14px; background: #e3ecfc; color: ${COLORS.primary};
      border: none; border-radius: 16px; font-size: 0.96em; cursor: pointer;
      transition: background 0.18s; font-weight: 500;
    }
    .chip:hover, .chip:focus { background: #c9dcfc; }
    @media (max-width: 460px) { .chip { font-size: 0.85em; } }
  `);
  // State

  // CONTRACT: location holds the currently displayed/weathered city;
  // query is *only* the user-typed input (completely controlled input field)
  // - query.value MAY NOT be directly/indirectly set except for:
  //   (a) First page mount, if empty (sync to initial location)
  //   (b) Actual user typing (onInput$ event)
  // - Prohibited: No effect, chip click, fetch result, or error handler may set/overwrite query.value.
  //               Do not destructure query or create side effects that "sync" input to backend state.
  // - Never "mirror" successful search, recents, or chip click event back into query.value!
  const location = useSignal("New York"); // currently shown weather's city

  /**
   * Pure controlled signal for city/location search input.
   *
   * The following contract is rigorously enforced:
   *   - query.value is changed only:
   *         (1) On explicit user input (onInput$; direct typing or pasting)
   *         (2) ONCE, at page load/mount if query.value is empty,
   *             in which case it's set to location.value. Never again.
   *   - Prohibited: query.value must NOT be mutated by fetchWeather, chip/city clicks, API responses,
   *     error reporting, effect hooks, nor any asynchronous update.
   *   - This contract guarantees user-typed input can never be overwritten or reset without their action.
   *   - NEVER set, sync, or clear query.value after a chip-click or fetch returns.
   *   - Input remains always user-editable (no "locked" bug).
   */
  const query = useSignal("");

  const loading = useSignal(false);
  const error = useSignal<string | null>(null);
  const current = useSignal<Weather | null>(null);
  const hourly = useSignal<Forecast[]>([]);
  const daily = useSignal<Forecast[]>([]);
  const recents = useSignal<string[]>(typeof window !== "undefined" ? loadRecents() : []);

  // PUBLIC_INTERFACE
  /**
   * Fetch weather data from the backend and handle all possible response types.
   * Shows a user-facing error if backend is unreachable, returns non-JSON, or backend returns error HTML, text, or incomplete data.
   */
  const fetchWeather = $(async (loc: string, addToRecents = true) => {
    loading.value = true;
    error.value = null;
    current.value = null;
    hourly.value = [];
    daily.value = [];
    try {
      const res = await fetch(`${ENDPOINT_BASE}?q=${encodeURIComponent(loc)}`);
      // Try to robustly handle different error/content types
      if (!res.ok) {
        // Try to figure out textual error message from backend/text/html
        let text = "";
        try {
          text = await res.text();
        } catch {
          // ignore
        }
        if (text && !text.startsWith("{") && text.length < 256) {
          throw new Error(
            `Backend error: ${text}` // show brief message if it's non-JSON, short text
          );
        }
        throw new Error("Location not found or backend error.");
      }
      // At this point, 'ok' is true. Try to parse as JSON, but guard against non-JSON
      let data: any = undefined;
      let rawText: string | undefined = undefined;
      try {
        // Peek at the Content-Type in a case-insensitive way, fallback to sniff
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          data = await res.json();
        } else {
          // Try to parse as json, but if it fails, give a descriptive error.
          rawText = await res.text();
          try {
            data = JSON.parse(rawText);
          } catch (err) {
            throw new Error(
              rawText && rawText.trim().startsWith("Not a SSR")
                ? "Backend server returned a SSR/HTML error. Please check backend deployment."
                : "The backend did not return valid weather data (invalid JSON)."
            );
          }
        }
      } catch (err: any) {
        // Defensive: If backend exploded with HTML, text, or gibberish, surface it
        if (typeof err?.message === "string" && err.message.match(/Unexpected token/i)) {
          throw new Error(
            "The weather service did not return valid data (bad response format)."
          );
        }
        throw err instanceof Error ? err : new Error("Could not parse weather data from server.");
      }
      // Defensive: Ensure the structure is as expected.
      if (
        !data ||
        !data.current ||
        typeof data.current.temp !== "number" ||
        typeof data.current.city !== "string"
      ) {
        throw new Error("Weather data unavailable for this location. Please try another city.");
      }
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
        country: data.current.country
      };
      hourly.value = Array.isArray(data.hourly)
        ? data.hourly.slice(0, 6).map((h: any) => ({
            dt: h.dt,
            temp: Math.round(h.temp),
            weather_icon: h.weather_icon,
            time: h.time,
            pop: h.pop,
          }))
        : [];
      daily.value = Array.isArray(data.daily)
        ? data.daily.slice(0, 5).map((d: any) => ({
            dt: d.dt,
            temp: Math.round(d.temp),
            weather_icon: d.weather_icon,
            date: d.date,
            pop: d.pop,
          }))
        : [];
      // Save recent
      if (addToRecents) {
        saveRecent(data.current.city);
        recents.value = loadRecents();
      }
    } catch (e: any) {
      // Handle network and unexpected errors usefully for the user.
      if (typeof e === "object" && e && "message" in e) {
        error.value =
          e.message.includes("SSR")
            ? "The backend server responded with an SSR error. (Not a server-side rendered request). Please check weather backend deployment and URL."
            : e.message;
      } else if (typeof e === "string") {
        error.value = e;
      } else {
        error.value = "Error fetching weather data. Please try again.";
      }
    } finally {
      loading.value = false;
    }
  });

  // --- Initial FIRST MOUNT: fetch default weather + set input field to default city if user hasn't typed yet ---
  // Use a ref flag to absolutely restrict sync to one time on true mount (for hydration too)
  let mountedRef = (globalThis as any).__initial_qwik_weather_mounted_ref;
  if (!mountedRef) {
    mountedRef = { seen: false };
    (globalThis as any).__initial_qwik_weather_mounted_ref = mountedRef;
  }

  // Only run *once* ever (per page/hydration): set up default weather and input
  if (!mountedRef.seen) {
    mountedRef.seen = true;
    // Fetch weather for default city shown (first mount)
    fetchWeather(location.value, false);
    // Set query.value (controlled input) to initial location if user hasn't typed yet.
    // DO NOT overwrite if user already type--the input always wins unless unset.
    if (!query.value) {
      query.value = location.value;
    }
  }

  // --- RENDER ---
  return (
    <div style={{
      minHeight: "100vh",
      background: COLORS.background,
      display: "flex",
      flexDirection: "column"
    }}>
      <div class="container" style={{
        maxWidth: 600,
        padding: "32px 16px 8px",
        margin: "auto"
      }}>
        {/* Header */}
        <header style={{
          display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28, gap: 12
        }}>
          <h1 style={{
            margin: 0, fontWeight: 600, fontSize: "2.2rem", color: "#222",
            letterSpacing: "-1px", textAlign: "center"
          }}>
            <span style={{ color: COLORS.primary }}>
              Weather Dashboard
            </span>
          </h1>
          {/* Search Form */}
          <form
            preventdefault:submit
            style={{
              width: "100%",
              display: "flex",
              gap: 8,
              justifyContent: "center"
            }}
            // PUBLIC_INTERFACE: The input value is controlled solely by query.value, reflecting only user-typed text or page reload.
            onSubmit$={async (e) => {
              e.preventDefault();
              if (!query.value.trim()) return;
              // Only fetch weather/show result, never mutate or clear query.value!
              await fetchWeather(query.value.trim());
              location.value = query.value.trim(); // Update which city is displayed, do NOT affect input box.
              // DO NOT: query.value = ...    (Never clear/reset on search result)
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
                transition: "border 0.2s"
              }}
              placeholder="Search location…"
              value={query.value}
              // PUBLIC_INTERFACE: Controlled component. 
              // Do not bind input value to anything but query.value. 
              // query.value must NOT be set by fetch or chip, only set below:
              onInput$={(e) => {
                // This is the ONLY ongoing place where query.value is altered (user's direct input).
                query.value = (e.target as HTMLInputElement).value;
              }}
              aria-label="Enter city or location"
              disabled={loading.value}
              autoFocus
            />
            <button
              type="submit"
              style={{
                border: "none",
                background: COLORS.primary,
                color: "#fff",
                borderRadius: 8,
                padding: "11px 22px",
                fontWeight: 500,
                fontSize: 16,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(25, 118, 210, 0.11)",
                transition: "background 0.2s"
              }}
              disabled={loading.value}
            >
              {loading.value ? "…" : "Search"}
            </button>
          </form>

          {/* Recent Search Chips */}
          {recents.value.length > 1 && (
            <div class="chip-row">
              {recents.value
                .filter(city => city !== current.value?.city)
                .slice(0, MAX_RECENTS - 1)
                .map(city => (
                  <button
                    class="chip"
                    key={city}
                    // PUBLIC_INTERFACE
                    /**
                     * IMPORTANT:
                     * Do NOT update query.value in this handler! Only actual user typing should update query.value.
                     * Chip clicks fetch weather and change visible panel but must NOT alter the input value or
                     * override user's current input draft.
                     */
                    onClick$={async () => {
                      if (loading.value) return;
                      // Fetch and display corresponding weather, do NOT clear/change input box.
                      await fetchWeather(city);
                      location.value = city;
                      // (Do NOT: query.value = city)
                    }}
                    aria-label={`Search ${city}`}
                  >
                    {city}
                  </button>
                ))}
            </div>
          )}
        </header>

        {/* Error UI */}
        {error.value && (
          <div
            style={{
              background: COLORS.error,
              color: COLORS.errorText,
              borderRadius: 7,
              padding: "13px 18px",
              margin: "16px 0 18px 0",
              textAlign: "center",
              fontSize: "1.08em",
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
              background: COLORS.card,
              borderRadius: 16,
              boxShadow: "0 2px 16px rgba(100,120,210,0.09)",
              padding: "30px 18px 18px",
              marginBottom: 30,
              minHeight: 190,
              position: "relative"
            }}
          >
            <div style={{
              position: "absolute",
              left: 20, top: 20,
              color: "#3a5c9c",
              fontWeight: 600,
              fontSize: "1rem"
            }}>
              {current.value.city}, {current.value.country}
            </div>
            <div style={{
              fontSize: "3.8rem",
              fontWeight: 700,
              color: COLORS.primary,
              marginTop: 14,
              lineHeight: "3.5rem"
            }}>
              {getWeatherIcon(current.value.weather_icon)} {current.value.temp}°
            </div>
            <div style={{
              fontWeight: 500,
              color: COLORS.secondary,
              fontSize: "1.3em",
              marginTop: 5,
              letterSpacing: "-0.5px"
            }}>
              {current.value.weather_main} ({current.value.weather_desc})
            </div>
            <div style={{
              display: "flex",
              gap: 20,
              marginTop: 16,
              flexWrap: "wrap",
              fontSize: "1em",
              justifyContent: "center",
              color: "#385080"
            }}>
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
                  fontSize: "1.2em",
                  color: COLORS.primary,
                  marginBottom: 7,
                  marginTop: 0,
                  fontWeight: 600,
                  textAlign: "left"
                }}>Next 6 Hours</h2>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6,1fr)",
                  gap: 10,
                  background: COLORS.card,
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
                  fontSize: "1.2em",
                  color: COLORS.primary,
                  marginBottom: 7,
                  marginTop: 18,
                  fontWeight: 600,
                  textAlign: "left"
                }}>5-Day Forecast</h2>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: 13,
                  background: COLORS.card,
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
            color: COLORS.primary,
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
          marginTop: 38,
          textAlign: "center"
        }}>
          Powered by <a href="https://openweathermap.org/" target="_blank" style={{
            color: COLORS.primary,
            fontWeight: 600,
            textDecoration: "underline"
          }}>OpenWeatherMap</a>. Built with Qwik.
        </footer>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Weather Dashboard",
  meta: [
    { name: "description", content: "Ultra-fast weather dashboard built with Qwik and FastAPI" }
  ]
};
