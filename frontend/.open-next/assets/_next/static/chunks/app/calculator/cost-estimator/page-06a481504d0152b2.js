(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [538],
  {
    2389: (e, l, i) => {
      (Promise.resolve().then(i.bind(i, 7411)), Promise.resolve().then(i.t.bind(i, 2619, 23)));
    },
    3850: (e, l, i) => {
      "use strict";
      i.d(l, { _: () => a });
      var s,
        t,
        n,
        r = i(5704);
      let a = {
        apiBaseUrl: null != (s = r.env.NEXT_PUBLIC_API_BASE_URL) ? s : "https://api.cloudgpus.io",
        apiKey: null != (n = null != (t = r.env.BUILD_API_KEY) ? t : r.env.API_KEY) ? n : null,
      };
    },
    4619: (e, l, i) => {
      "use strict";
      function s(e) {
        return null != e && Number.isFinite(e) ? "$".concat(e.toFixed(2), "/hr") : "—";
      }
      function t(e) {
        let l = new Date(e).getTime();
        if (!Number.isFinite(l)) return "—";
        let i = Date.now() - l;
        if (!Number.isFinite(i)) return "—";
        let s = Math.floor(i / 6e4);
        if (s < 1) return "just now";
        if (s < 60) return "".concat(s, "m ago");
        let t = Math.floor(s / 60);
        if (t < 24) return "".concat(t, "h ago");
        let n = Math.floor(t / 24);
        return "".concat(n, "d ago");
      }
      i.d(l, { b: () => s, f: () => t });
    },
    7411: (e, l, i) => {
      "use strict";
      i.d(l, { CostEstimator: () => c });
      var s = i(5155),
        t = i(2115),
        n = i(2619),
        r = i.n(n),
        a = i(3850);
      let d = Object.fromEntries(
        Object.entries({
          b200: "b200-sxm",
          gb200: "gb200-nvl",
          h200: "h200-sxm",
          h100: "h100-sxm",
        }).map((e) => {
          let [l, i] = e;
          return [i, l];
        }),
      );
      var o = i(4619);
      function c(e) {
        var l, i, n, c, u;
        let { gpus: p } = e,
          h = p.length >= 2,
          [g, m] = (0, t.useState)(() => {
            var e, l;
            return null != (l = null == (e = p[0]) ? void 0 : e.slug) ? l : "";
          }),
          [v, x] = (0, t.useState)(""),
          [y, j] = (0, t.useState)(!0),
          [b, f] = (0, t.useState)(1),
          [N, S] = (0, t.useState)(8),
          [P, _] = (0, t.useState)(0.7),
          [w, T] = (0, t.useState)("cheapest"),
          [U, C] = (0, t.useState)(null),
          [z, E] = (0, t.useState)("idle");
        (0, t.useEffect)(() => {
          if (!h || !g) {
            (C(null), E("idle"));
            return;
          }
          let e = !1;
          return (
            (async function () {
              E("loading");
              try {
                let l = new URL("/api/compare-prices", a._.apiBaseUrl);
                (l.searchParams.set("gpuSlug", g),
                  l.searchParams.set("includeSpot", "true"),
                  v && l.searchParams.set("tier", v));
                let i = await fetch(l.toString(), { headers: { accept: "application/json" } });
                if (!i.ok) throw Error("HTTP ".concat(i.status));
                let s = await i.json();
                if (e) return;
                (C(s), E("idle"));
              } catch (l) {
                if (e) return;
                (C(null), E("error"));
              }
            })(),
            () => {
              e = !0;
            }
          );
        }, [g, v, h]);
        let I = (0, t.useMemo)(() => {
            var e;
            if (!U) return null;
            let l = U.prices,
              i = (e) => {
                var l;
                let i = y ? e.spot : null;
                return null != (l = null != i ? i : e.onDemand) ? l : null;
              };
            if ("cheapest" === w) {
              let e = null,
                s = null;
              for (let t of l) {
                let l = i(t);
                null != l && Number.isFinite(l) && (null == s || l < s) && ((s = l), (e = t));
              }
              return e ? { row: e, price: s } : null;
            }
            let s = null != (e = l.find((e) => e.provider.slug === w)) ? e : null;
            return s ? { row: s, price: i(s) } : null;
          }, [U, w, y]),
          A = (0, t.useMemo)(
            () =>
              (null == I ? void 0 : I.price) &&
              Number.isFinite(N) &&
              !(N <= 0) &&
              Number.isFinite(b) &&
              !(b <= 0)
                ? I.price * b * N
                : null,
            [I, b, N],
          ),
          F = (0, t.useMemo)(
            () =>
              (null == I ? void 0 : I.price) &&
              Number.isFinite(P) &&
              !(P < 0) &&
              !(P > 1) &&
              Number.isFinite(b) &&
              !(b <= 0)
                ? I.price * b * 720 * P
                : null,
            [I, b, P],
          );
        return h
          ? (0, s.jsxs)("div", {
              className: "grid grid2",
              style: { alignItems: "start" },
              children: [
                (0, s.jsxs)("section", {
                  className: "card",
                  style: { padding: 16 },
                  children: [
                    (0, s.jsx)("div", { style: { fontWeight: 800 }, children: "Inputs" }),
                    (0, s.jsx)("div", {
                      className: "muted",
                      style: { marginTop: 6, lineHeight: 1.6, fontSize: 13 },
                      children:
                        "Pick a GPU, optionally filter by provider tier, and choose whether to use spot pricing when available.",
                    }),
                    (0, s.jsxs)("div", {
                      style: { display: "grid", gap: 10, marginTop: 12 },
                      children: [
                        (0, s.jsxs)("label", {
                          style: { display: "grid", gap: 6 },
                          children: [
                            (0, s.jsx)("span", {
                              className: "muted",
                              style: { fontSize: 13 },
                              children: "GPU",
                            }),
                            (0, s.jsx)("select", {
                              value: g,
                              onChange: (e) => m(e.target.value),
                              style: {
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: "1px solid rgba(15, 23, 42, 0.12)",
                              },
                              children: p.map((e) =>
                                (0, s.jsxs)(
                                  "option",
                                  { value: e.slug, children: [e.name, " (", e.vram_gb, "GB)"] },
                                  e.slug,
                                ),
                              ),
                            }),
                          ],
                        }),
                        (0, s.jsxs)("div", {
                          className: "grid grid2",
                          style: { gap: 10 },
                          children: [
                            (0, s.jsxs)("label", {
                              style: { display: "grid", gap: 6 },
                              children: [
                                (0, s.jsx)("span", {
                                  className: "muted",
                                  style: { fontSize: 13 },
                                  children: "Provider tier",
                                }),
                                (0, s.jsxs)("select", {
                                  value: v,
                                  onChange: (e) => x(e.target.value),
                                  style: {
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(15, 23, 42, 0.12)",
                                  },
                                  children: [
                                    (0, s.jsx)("option", { value: "", children: "All tiers" }),
                                    (0, s.jsx)("option", {
                                      value: "enterprise",
                                      children: "Enterprise",
                                    }),
                                    (0, s.jsx)("option", {
                                      value: "standard",
                                      children: "Standard",
                                    }),
                                    (0, s.jsx)("option", {
                                      value: "community",
                                      children: "Community",
                                    }),
                                  ],
                                }),
                              ],
                            }),
                            (0, s.jsxs)("label", {
                              style: { display: "grid", gap: 6 },
                              children: [
                                (0, s.jsx)("span", {
                                  className: "muted",
                                  style: { fontSize: 13 },
                                  children: "Provider",
                                }),
                                (0, s.jsxs)("select", {
                                  value: w,
                                  onChange: (e) => T(e.target.value),
                                  style: {
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(15, 23, 42, 0.12)",
                                  },
                                  children: [
                                    (0, s.jsx)("option", {
                                      value: "cheapest",
                                      children: "Cheapest (auto)",
                                    }),
                                    (null != (l = null == U ? void 0 : U.prices) ? l : []).map(
                                      (e) => {
                                        var l;
                                        return (0, s.jsxs)(
                                          "option",
                                          {
                                            value: e.provider.slug,
                                            children: [
                                              e.provider.name,
                                              " \xb7 ",
                                              (0, o.b)(
                                                null != (l = y ? e.spot : null) ? l : e.onDemand,
                                              ),
                                            ],
                                          },
                                          e.provider.slug,
                                        );
                                      },
                                    ),
                                  ],
                                }),
                              ],
                            }),
                          ],
                        }),
                        (0, s.jsxs)("label", {
                          style: { display: "flex", gap: 10, alignItems: "center" },
                          children: [
                            (0, s.jsx)("input", {
                              type: "checkbox",
                              checked: y,
                              onChange: (e) => j(e.target.checked),
                            }),
                            (0, s.jsx)("span", {
                              className: "muted",
                              style: { fontSize: 13 },
                              children: "Use spot/preemptible price when available",
                            }),
                          ],
                        }),
                        (0, s.jsxs)("div", {
                          className: "grid grid2",
                          style: { gap: 10 },
                          children: [
                            (0, s.jsxs)("label", {
                              style: { display: "grid", gap: 6 },
                              children: [
                                (0, s.jsx)("span", {
                                  className: "muted",
                                  style: { fontSize: 13 },
                                  children: "GPU count",
                                }),
                                (0, s.jsx)("input", {
                                  value: b,
                                  onChange: (e) => f(Number(e.target.value)),
                                  inputMode: "numeric",
                                  style: {
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(15, 23, 42, 0.12)",
                                  },
                                }),
                              ],
                            }),
                            (0, s.jsxs)("label", {
                              style: { display: "grid", gap: 6 },
                              children: [
                                (0, s.jsx)("span", {
                                  className: "muted",
                                  style: { fontSize: 13 },
                                  children: "Runtime (hours)",
                                }),
                                (0, s.jsx)("input", {
                                  value: N,
                                  onChange: (e) => S(Number(e.target.value)),
                                  inputMode: "decimal",
                                  style: {
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(15, 23, 42, 0.12)",
                                  },
                                }),
                              ],
                            }),
                          ],
                        }),
                        (0, s.jsxs)("label", {
                          style: { display: "grid", gap: 6 },
                          children: [
                            (0, s.jsx)("span", {
                              className: "muted",
                              style: { fontSize: 13 },
                              children: "Monthly utilization (0–1)",
                            }),
                            (0, s.jsx)("input", {
                              value: P,
                              onChange: (e) => _(Number(e.target.value)),
                              inputMode: "decimal",
                              style: {
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: "1px solid rgba(15, 23, 42, 0.12)",
                              },
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                (0, s.jsxs)("section", {
                  className: "card",
                  style: { padding: 16 },
                  children: [
                    (0, s.jsx)("div", { style: { fontWeight: 800 }, children: "Estimate" }),
                    (0, s.jsx)("div", {
                      className: "muted",
                      style: { marginTop: 6, lineHeight: 1.6, fontSize: 13 },
                      children:
                        "This is an estimate based on the selected hourly price. Always verify billing increments, minimum rental time, and add‑ons such as storage and egress.",
                    }),
                    "loading" === z
                      ? (0, s.jsx)("div", {
                          className: "muted",
                          style: { marginTop: 12 },
                          children: "Loading pricing…",
                        })
                      : "error" === z
                        ? (0, s.jsx)("div", {
                            className: "muted",
                            style: { marginTop: 12 },
                            children:
                              "Could not load pricing data. Check `NEXT_PUBLIC_API_BASE_URL` and try again.",
                          })
                        : null,
                    (0, s.jsxs)("div", {
                      style: { marginTop: 12, display: "grid", gap: 12 },
                      children: [
                        (0, s.jsxs)("div", {
                          className: "card",
                          style: { padding: 14 },
                          children: [
                            (0, s.jsx)("div", {
                              className: "muted",
                              style: { fontSize: 12 },
                              children: "Selected price",
                            }),
                            (0, s.jsx)("div", {
                              style: { fontWeight: 800, marginTop: 6 },
                              children: (0, o.b)(
                                null != (i = null == I ? void 0 : I.price) ? i : null,
                              ),
                            }),
                            (0, s.jsxs)("div", {
                              className: "muted",
                              style: { marginTop: 8, lineHeight: 1.7, fontSize: 13 },
                              children: [
                                (0, s.jsxs)("div", {
                                  children: [
                                    "Provider: ",
                                    null != (n = null == I ? void 0 : I.row.provider.name)
                                      ? n
                                      : "—",
                                  ],
                                }),
                                (0, s.jsxs)("div", {
                                  children: [
                                    "Availability: ",
                                    null != (c = null == I ? void 0 : I.row.availability) ? c : "—",
                                  ],
                                }),
                                (0, s.jsxs)("div", {
                                  children: [
                                    "Updated:",
                                    " ",
                                    (null == I ? void 0 : I.row.lastUpdated)
                                      ? new Date(I.row.lastUpdated).toLocaleString()
                                      : "—",
                                  ],
                                }),
                              ],
                            }),
                            (0, s.jsxs)("div", {
                              style: { marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" },
                              children: [
                                (0, s.jsx)(r(), {
                                  className: "btn btnSecondary",
                                  href: "/cloud-gpu/".concat(null != (u = d[g]) ? u : g),
                                  children: "GPU pricing page",
                                }),
                                (null == I ? void 0 : I.row.provider.slug)
                                  ? (0, s.jsx)(r(), {
                                      className: "btn btnSecondary",
                                      href: "/provider/".concat(I.row.provider.slug),
                                      children: "Provider page",
                                    })
                                  : null,
                              ],
                            }),
                          ],
                        }),
                        (0, s.jsxs)("div", {
                          className: "grid grid2",
                          children: [
                            (0, s.jsxs)("div", {
                              className: "card",
                              style: { padding: 14 },
                              children: [
                                (0, s.jsx)("div", {
                                  className: "muted",
                                  style: { fontSize: 12 },
                                  children: "Training run (hours)",
                                }),
                                (0, s.jsx)("div", {
                                  style: { fontWeight: 800, marginTop: 6 },
                                  children: null != A ? "$".concat(A.toFixed(2)) : "—",
                                }),
                                (0, s.jsx)("div", {
                                  className: "muted",
                                  style: { marginTop: 8, fontSize: 12 },
                                  children: "total = $/GPU‑hr \xd7 gpu_count \xd7 hours",
                                }),
                              ],
                            }),
                            (0, s.jsxs)("div", {
                              className: "card",
                              style: { padding: 14 },
                              children: [
                                (0, s.jsx)("div", {
                                  className: "muted",
                                  style: { fontSize: 12 },
                                  children: "Monthly (utilization)",
                                }),
                                (0, s.jsx)("div", {
                                  style: { fontWeight: 800, marginTop: 6 },
                                  children: null != F ? "$".concat(F.toFixed(2)) : "—",
                                }),
                                (0, s.jsx)("div", {
                                  className: "muted",
                                  style: { marginTop: 8, fontSize: 12 },
                                  children:
                                    "monthly = $/GPU‑hr \xd7 gpu_count \xd7 24 \xd7 30 \xd7 utilization",
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            })
          : (0, s.jsxs)("div", {
              className: "card",
              style: { padding: 16 },
              children: [
                (0, s.jsx)("div", {
                  style: { fontWeight: 800 },
                  children: "Cost estimator unavailable",
                }),
                (0, s.jsxs)("div", {
                  className: "muted",
                  style: { marginTop: 8, lineHeight: 1.7 },
                  children: [
                    "We couldn’t load the GPU catalog. Configure ",
                    (0, s.jsx)("code", { children: "NEXT_PUBLIC_API_BASE_URL" }),
                    " and ensure the API is reachable, then refresh.",
                  ],
                }),
              ],
            });
      }
    },
  },
  (e) => {
    (e.O(0, [0, 441, 255, 358], () => e((e.s = 2389))), (_N_E = e.O()));
  },
]);
