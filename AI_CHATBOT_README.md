# AI Analytics Chatbot - AutoMatrix SuperAdmin Dashboard

This README details the design, architecture, configuration, and resilience mechanisms of the stateless AI Chatbot integrated into the SuperAdmin Analytics view (`/superadmin/analytics`).

---

## 📋 Features & User Experience
1. **Floating Action Trigger (FAB):** 
   * A circular floating button with a `Sparkles` icon is docked in the bottom-right corner of the screen.
   * Clicking the button opens/closes a compact, blur-glassmorphic chat overlay right above it.
2. **Context-Aware Analytics Querying:**
   * On every request, the chatbot automatically bundles the currently loaded date range data (retrieved from the charts state) and passes it as context.
   * The AI uses *only* this JSON data to answer queries, preventing hallucinations about numbers, categories, or trends not on the screen.
3. **Frictionless Suggestions:**
   * Clicking suggested prompt chips ("Summarize this period", "Which vendor is leading?", etc.) instantly queries the AI.
4. **Environment Indicators:**
   * Dynamic loading spinners show `AI is analyzing your data...` during generation.
   * Clear warnings instruct that data context automatically updates when the date range filter at the top is changed.

---

## 🛠️ System Architecture

### 1. Frontend Client
* **Component File:** [`client/src/pages/superadmin/AnalyticsAIChat.tsx`](file:///Users/mishal/code/LS2/ecom-autoparts/client/src/pages/superadmin/AnalyticsAIChat.tsx)
  * Uses React states to maintain open/closed triggers, chat logs, loaders, and text input strings.
  * Styled using custom backdrop filters and Framer Motion transitions.
* **API Connector:** [`client/src/lib/api.ts`](file:///Users/mishal/code/LS2/ecom-autoparts/client/src/lib/api.ts#L1438-L1451)
  * Wrapper method `askAnalyticsAI(question, analyticsData, dateRange)` which executes a POST to `/admin-analytics/superadmin/ask` returning `{ answer: string }`.

### 2. Backend Server
* **Route Configuration:** [`server/routes/adminAnalytics.routes.js`](file:///Users/mishal/code/LS2/ecom-autoparts/server/routes/adminAnalytics.routes.js)
  * Route: `POST /api/admin-analytics/superadmin/ask`
  * Middlewares applied:
    * `verifyToken` & `isSuperAdmin` (authentication validation).
    * `askRateLimiter` (in-memory rate limiter restricted to **10 requests per minute per user**).
* **Controller:** [`server/controllers/adminAnalyticsController.js`](file:///Users/mishal/code/LS2/ecom-autoparts/server/controllers/adminAnalyticsController.js#L209)
  * Implements query filtering, system instruction injection, payload checks, and HTTP 502/400 wrappers.

---

## 🛡️ Model Resiliency & Fallback Chain
To avoid API downtime from model-specific free tier limits (such as `429 Resource Exhausted` or `503 Service Unavailable` demand spikes), the controller uses a **sequential fallback chain** to evaluate queries.

If a model fails, the system logs a fallback warning on the server console and automatically attempts the next model in this order:
1. `process.env.GEMINI_MODEL` (User custom model, if configured)
2. `gemini-flash-latest` (Resolves to `gemini-3.5-flash`)
3. `gemini-2.0-flash`
4. `gemini-2.5-flash`
5. `gemini-3.5-flash`

---

## ⚙️ Configuration
Add the credentials in your local environment file:

```env
# server/.env
GEMINI_API_KEY=your_google_gemini_api_key
```

*(Optional)* Configure a custom model version:
```env
# server/.env
GEMINI_MODEL=gemini-2.5-flash
```
