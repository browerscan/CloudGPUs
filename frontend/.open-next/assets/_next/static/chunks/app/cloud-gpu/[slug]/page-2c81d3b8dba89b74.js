(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [169],
  {
    487: (e, r, t) => {
      "use strict";
      t.d(r, { SocialProof: () => n });
      var a = t(5155),
        s = t(2115),
        i = t(3850);
      function n(e) {
        let { gpuSlug: r, gpuName: t } = e,
          [n, l] = (0, s.useState)(null),
          [o, d] = (0, s.useState)(!0);
        if (
          ((0, s.useEffect)(() => {
            fetch(
              "".concat(i._.apiBaseUrl, "/api/gpu-models/").concat(encodeURIComponent(r), "/stats"),
            )
              .then((e) => (e.ok ? e.json() : null))
              .then((e) => {
                e && l(e);
              })
              .catch(() => {})
              .finally(() => d(!1));
          }, [r]),
          o)
        )
          return (0, a.jsx)("div", {
            style: {
              padding: "12px 16px",
              background: "rgba(15, 23, 42, 0.03)",
              borderRadius: 10,
              display: "flex",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
            },
            children: (0, a.jsx)("div", {
              className: "muted",
              style: { fontSize: 13 },
              children: "Loading stats...",
            }),
          });
        if (!n) return null;
        let c = [];
        return (n.viewsLast7Days > 10 &&
          c.push(
            (0, a.jsxs)(
              "span",
              {
                className: "badge",
                style: {
                  background: "rgba(59, 130, 246, 0.12)",
                  color: "rgb(30, 64, 175)",
                  borderColor: "rgba(59, 130, 246, 0.3)",
                },
                children: [
                  n.viewsLast7Days.toLocaleString(),
                  " users viewed this GPU in the last 7 days",
                ],
              },
              "views",
            ),
          ),
        n.mostPopularProvider &&
          c.push(
            (0, a.jsxs)(
              "span",
              {
                className: "badge badgeGreen",
                style: {
                  background: "rgba(16, 185, 129, 0.12)",
                  color: "rgb(6, 95, 70)",
                  borderColor: "rgba(16, 185, 129, 0.35)",
                },
                children: ["Most popular provider: ", n.mostPopularProvider],
              },
              "popular",
            ),
          ),
        0 === c.length)
          ? null
          : (0, a.jsxs)("div", {
              style: {
                padding: "12px 16px",
                background: "rgba(15, 23, 42, 0.03)",
                borderRadius: 10,
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              },
              children: [
                (0, a.jsx)("span", {
                  className: "muted",
                  style: { fontSize: 13, fontWeight: 600 },
                  children: "Trending:",
                }),
                c,
              ],
            });
      }
    },
    679: (e, r, t) => {
      (Promise.resolve().then(t.bind(t, 2540)),
        Promise.resolve().then(t.bind(t, 6299)),
        Promise.resolve().then(t.bind(t, 487)),
        Promise.resolve().then(t.t.bind(t, 2619, 23)),
        Promise.resolve().then(t.bind(t, 4437)),
        Promise.resolve().then(t.bind(t, 6552)));
    },
    2540: (e, r, t) => {
      "use strict";
      t.d(r, { PriceAlertForm: () => d });
      var a = t(5155),
        s = t(2115),
        i = t(3850),
        n = t(4619);
      let l = {
          realistic: {
            bg: "rgba(16, 185, 129, 0.12)",
            color: "rgb(6, 95, 70)",
            border: "rgba(16, 185, 129, 0.35)",
          },
          moderate: {
            bg: "rgba(251, 146, 60, 0.12)",
            color: "rgb(180, 83, 9)",
            border: "rgba(251, 146, 60, 0.35)",
          },
          aggressive: {
            bg: "rgba(239, 68, 68, 0.12)",
            color: "rgb(185, 28, 28)",
            border: "rgba(239, 68, 68, 0.35)",
          },
        },
        o = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      function d(e) {
        let { gpuSlug: r, currentCheapestPrice: t, providerSlug: d } = e,
          [c, u] = (0, s.useState)(""),
          [g, b] = (0, s.useState)(() => (t && t > 0 ? Math.round(100 * t) / 100 : 2)),
          [p, m] = (0, s.useState)({ kind: "idle" }),
          h = "submitting" === p.kind,
          f = (0, s.useMemo)(
            () =>
              !t || t <= 0
                ? []
                : [
                    {
                      label: "Realistic (5% below)",
                      price: Math.round(0.95 * t * 100) / 100,
                      aggressiveness: "realistic",
                    },
                    {
                      label: "Moderate (10% below)",
                      price: Math.round(0.9 * t * 100) / 100,
                      aggressiveness: "moderate",
                    },
                    {
                      label: "Aggressive (20% below)",
                      price: Math.round(0.8 * t * 100) / 100,
                      aggressiveness: "aggressive",
                    },
                  ].filter((e) => e.price > 0 && e.price < t),
            [t],
          ),
          y = (0, s.useMemo)(() => !!o.test(c.trim()) && !!Number.isFinite(g) && !(g <= 0), [c, g]),
          v = c.trim() && !o.test(c.trim()),
          x = Number.isFinite(g) && g <= 0,
          j = t && g >= t;
        async function S(e) {
          if ((e.preventDefault(), y)) {
            m({ kind: "submitting" });
            try {
              let e = await fetch("".concat(i._.apiBaseUrl, "/api/alerts/subscribe"), {
                method: "POST",
                headers: { "content-type": "application/json", accept: "application/json" },
                body: JSON.stringify({
                  email: c.trim(),
                  gpuSlug: r,
                  providerSlug: d,
                  targetPricePerGpuHour: g,
                }),
              });
              if (!e.ok) throw Error("HTTP ".concat(e.status));
              let t = await e.json();
              "already_confirmed" === t.status
                ? m({
                    kind: "success",
                    message:
                      "Alert updated. You will get an email when the price hits your target.",
                  })
                : m({
                    kind: "success",
                    message: "Check your email to confirm your alert (double opt-in).",
                  });
            } catch (e) {
              m({
                kind: "error",
                message: e instanceof Error ? e.message : "Failed to create alert",
              });
            }
          }
        }
        return (0, a.jsxs)("form", {
          onSubmit: S,
          className: "card",
          style: { padding: 16 },
          children: [
            (0, a.jsx)("div", { style: { fontWeight: 800 }, children: "Price drop alert" }),
            (0, a.jsxs)("div", {
              className: "muted",
              style: { marginTop: 6, lineHeight: 1.6, fontSize: 13 },
              children: [
                "Get an email when the cheapest observed price for ",
                (0, a.jsx)("code", { children: r }),
                d
                  ? (0, a.jsxs)(a.Fragment, {
                      children: [" ", "on ", (0, a.jsx)("code", { children: d })],
                    })
                  : " across providers",
                " ",
                "drops below your target.",
              ],
            }),
            null != t && t > 0
              ? (0, a.jsxs)("div", {
                  style: {
                    marginTop: 12,
                    padding: "10px 14px",
                    background: "rgba(16, 185, 129, 0.1)",
                    borderRadius: 8,
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                  },
                  children: [
                    (0, a.jsx)("div", {
                      className: "muted",
                      style: { fontSize: 12, fontWeight: 600 },
                      children: "Current cheapest price",
                    }),
                    (0, a.jsx)("div", {
                      style: { fontSize: 18, fontWeight: 700, color: "rgb(6, 95, 70)" },
                      children: (0, n.b)(t),
                    }),
                  ],
                })
              : null,
            f.length > 0
              ? (0, a.jsxs)("div", {
                  style: { marginTop: 12 },
                  children: [
                    (0, a.jsx)("div", {
                      className: "muted",
                      style: { fontSize: 12, marginBottom: 6, fontWeight: 600 },
                      children: "Suggested targets",
                    }),
                    (0, a.jsx)("div", {
                      style: { display: "flex", gap: 8, flexWrap: "wrap" },
                      children: f.map((e) => {
                        let r = l[e.aggressiveness],
                          t = g === e.price;
                        return (0, a.jsxs)(
                          "button",
                          {
                            type: "button",
                            onClick: () => b(e.price),
                            disabled: h,
                            className: "btn",
                            style: {
                              fontSize: 13,
                              padding: "6px 12px",
                              background: t ? r.bg : "rgba(15, 23, 42, 0.06)",
                              color: t ? r.color : "inherit",
                              borderColor: t ? r.border : "rgba(15, 23, 42, 0.12)",
                              cursor: h ? "not-allowed" : "pointer",
                              opacity: h ? 0.6 : 1,
                            },
                            children: [e.label, " (", (0, n.b)(e.price), ")"],
                          },
                          e.label,
                        );
                      }),
                    }),
                  ],
                })
              : null,
            (0, a.jsxs)("div", {
              style: { display: "grid", gap: 10, marginTop: 12 },
              className: "grid grid2",
              children: [
                (0, a.jsxs)("label", {
                  style: { display: "grid", gap: 6 },
                  children: [
                    (0, a.jsx)("span", {
                      className: "muted",
                      style: { fontSize: 13 },
                      children: "Email",
                    }),
                    (0, a.jsx)("input", {
                      value: c,
                      onChange: (e) => u(e.target.value),
                      disabled: h,
                      placeholder: "you@example.com",
                      type: "email",
                      autoComplete: "email",
                      "aria-invalid": !!v || void 0,
                      "aria-describedby": v ? "email-error" : void 0,
                      className: "input",
                    }),
                    v
                      ? (0, a.jsx)("span", {
                          id: "email-error",
                          className: "muted",
                          style: { fontSize: 12, color: "rgb(185, 28, 28)" },
                          children: "Please enter a valid email address",
                        })
                      : null,
                  ],
                }),
                (0, a.jsxs)("label", {
                  style: { display: "grid", gap: 6 },
                  children: [
                    (0, a.jsx)("span", {
                      className: "muted",
                      style: { fontSize: 13 },
                      children: "Target ($/GPU-hr)",
                    }),
                    (0, a.jsx)("input", {
                      value: Number.isFinite(g) ? g : "",
                      onChange: (e) => b(Number(e.target.value)),
                      disabled: h,
                      inputMode: "decimal",
                      type: "number",
                      step: "0.01",
                      min: "0",
                      "aria-invalid": !!x || !!j || void 0,
                      "aria-describedby": x ? "target-error" : j ? "target-warning" : void 0,
                      className: "input",
                      style: j
                        ? {
                            borderColor: "rgb(251, 146, 60)",
                            background: "rgba(251, 146, 60, 0.08)",
                          }
                        : void 0,
                    }),
                    x
                      ? (0, a.jsx)("span", {
                          id: "target-error",
                          className: "muted",
                          style: { fontSize: 12, color: "rgb(185, 28, 28)" },
                          children: "Target must be greater than 0",
                        })
                      : j
                        ? (0, a.jsx)("span", {
                            id: "target-warning",
                            className: "muted",
                            style: { fontSize: 12, color: "rgb(180, 83, 9)" },
                            children:
                              "Target is at or above current price. You may never receive an alert.",
                          })
                        : null,
                  ],
                }),
              ],
            }),
            (0, a.jsxs)("div", {
              style: {
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
                marginTop: 12,
              },
              children: [
                (0, a.jsx)("button", {
                  className: "btn",
                  type: "submit",
                  disabled: !y || h,
                  children: "submitting" === p.kind ? "Creating alert..." : "Create price alert",
                }),
                "success" === p.kind
                  ? (0, a.jsx)("span", {
                      role: "status",
                      style: { fontSize: 13, color: "rgb(6, 95, 70)" },
                      children: p.message,
                    })
                  : null,
                "error" === p.kind
                  ? (0, a.jsxs)("span", {
                      role: "alert",
                      style: { fontSize: 13, color: "rgb(185, 28, 28)" },
                      children: ["Error: ", p.message],
                    })
                  : null,
              ],
            }),
            (0, a.jsx)("div", {
              className: "muted",
              style: { marginTop: 12, fontSize: 12, lineHeight: 1.5 },
              children:
                "You can cancel or update your alerts anytime via the unsubscribe link in emails.",
            }),
          ],
        });
      }
    },
    4054: (e, r) => {
      "use strict";
      (Object.defineProperty(r, "__esModule", { value: !0 }),
        !(function (e, r) {
          for (var t in r) Object.defineProperty(e, t, { enumerable: !0, get: r[t] });
        })(r, {
          bindSnapshot: function () {
            return n;
          },
          createAsyncLocalStorage: function () {
            return i;
          },
          createSnapshot: function () {
            return l;
          },
        }));
      let t = Object.defineProperty(
        Error("Invariant: AsyncLocalStorage accessed in runtime where it is not available"),
        "__NEXT_ERROR_CODE",
        { value: "E504", enumerable: !1, configurable: !0 },
      );
      class a {
        disable() {
          throw t;
        }
        getStore() {}
        run() {
          throw t;
        }
        exit() {
          throw t;
        }
        enterWith() {
          throw t;
        }
        static bind(e) {
          return e;
        }
      }
      let s = "undefined" != typeof globalThis && globalThis.AsyncLocalStorage;
      function i() {
        return s ? new s() : new a();
      }
      function n(e) {
        return s ? s.bind(e) : a.bind(e);
      }
      function l() {
        return s
          ? s.snapshot()
          : function (e, ...r) {
              return e(...r);
            };
      }
    },
    4437: (e, r, t) => {
      "use strict";
      function a(e) {
        let { reason: r, children: t } = e;
        return t;
      }
      (Object.defineProperty(r, "__esModule", { value: !0 }),
        Object.defineProperty(r, "BailoutToCSR", {
          enumerable: !0,
          get: function () {
            return a;
          },
        }),
        t(4553));
    },
    6552: (e, r, t) => {
      "use strict";
      function a(e) {
        let { moduleIds: r } = e;
        return null;
      }
      (Object.defineProperty(r, "__esModule", { value: !0 }),
        Object.defineProperty(r, "PreloadChunks", {
          enumerable: !0,
          get: function () {
            return a;
          },
        }),
        t(5155),
        t(7650),
        t(8567),
        t(7278));
    },
    7828: (e, r, t) => {
      "use strict";
      (Object.defineProperty(r, "__esModule", { value: !0 }),
        Object.defineProperty(r, "workAsyncStorageInstance", {
          enumerable: !0,
          get: function () {
            return a;
          },
        }));
      let a = (0, t(4054).createAsyncLocalStorage)();
    },
    8567: (e, r, t) => {
      "use strict";
      (Object.defineProperty(r, "__esModule", { value: !0 }),
        Object.defineProperty(r, "workAsyncStorage", {
          enumerable: !0,
          get: function () {
            return a.workAsyncStorageInstance;
          },
        }));
      let a = t(7828);
    },
  },
  (e) => {
    (e.O(0, [0, 299, 441, 255, 358], () => e((e.s = 679))), (_N_E = e.O()));
  },
]);
