"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [299],
  {
    3850: (e, l, n) => {
      n.d(l, { _: () => s });
      var t,
        a,
        i,
        r = n(5704);
      let s = {
        apiBaseUrl: null != (t = r.env.NEXT_PUBLIC_API_BASE_URL) ? t : "https://api.cloudgpus.io",
        apiKey: null != (i = null != (a = r.env.BUILD_API_KEY) ? a : r.env.API_KEY) ? i : null,
      };
    },
    4619: (e, l, n) => {
      function t(e) {
        return null != e && Number.isFinite(e) ? "$".concat(e.toFixed(2), "/hr") : "—";
      }
      function a(e) {
        let l = new Date(e).getTime();
        if (!Number.isFinite(l)) return "—";
        let n = Date.now() - l;
        if (!Number.isFinite(n)) return "—";
        let t = Math.floor(n / 6e4);
        if (t < 1) return "just now";
        if (t < 60) return "".concat(t, "m ago");
        let a = Math.floor(t / 60);
        if (a < 24) return "".concat(a, "h ago");
        let i = Math.floor(a / 24);
        return "".concat(i, "d ago");
      }
      n.d(l, { b: () => t, f: () => a });
    },
    6299: (e, l, n) => {
      (n.r(l), n.d(l, { PriceTable: () => o }));
      var t = n(5155),
        a = n(2115),
        i = n(7621),
        r = n(4619);
      let s = {
        region: "all",
        networkType: "all",
        billingIncrement: "all",
        availability: "all",
        maxPrice: "",
        showStale: !1,
      };
      function o(e) {
        let { gpuSlug: l, rows: n } = e,
          [o, c] = (0, a.useState)(() => {
            let e = new URLSearchParams(window.location.search),
              l = e.get("network"),
              n = ["all", "infiniband", "nvlink"].includes(l) ? l : "all",
              t = e.get("billing"),
              a = ["all", "per-minute", "per-hour"].includes(t) ? t : "all",
              i = e.get("availability"),
              r = ["all", "available", "limited"].includes(i) ? i : "all",
              s = e.get("maxPrice"),
              o = s && !Number.isNaN(Number(s)) && Number(s) >= 0 ? Number(s) : "",
              c = e.get("region");
            return {
              region: c && c.length <= 100 ? c : "all",
              networkType: n,
              billingIncrement: a,
              availability: r,
              maxPrice: o,
              showStale: "true" === e.get("showStale"),
            };
          }),
          d = (0, a.useMemo)(() => {
            let e = new Set();
            return (
              n.forEach((l) => {
                var n;
                null == (n = l.instance.regions) || n.forEach((l) => e.add(l));
              }),
              Array.from(e).sort()
            );
          }, [n]),
          u = (0, a.useMemo)(
            () =>
              2 === o.maxPrice ? "under2" : "available" === o.availability ? "available" : null,
            [o],
          ),
          p = (0, a.useMemo)(
            () =>
              n.filter((e) => {
                var l, n;
                let t = null != (l = e.spot) ? l : e.onDemand,
                  a = new Date(e.lastUpdated).getTime(),
                  i = Number.isFinite(a) ? (Date.now() - a) / 36e5 : null;
                if (
                  (!o.showStale && null != i && i > 48) ||
                  ("all" !== o.region &&
                    !(null == (n = e.instance.regions) ? void 0 : n.includes(o.region))) ||
                  ("infiniband" === o.networkType && !e.instance.hasInfiniband) ||
                  ("nvlink" === o.networkType && !e.instance.hasNvlink) ||
                  ("per-minute" === o.billingIncrement &&
                    (!e.instance.billingIncrementSeconds ||
                      e.instance.billingIncrementSeconds >= 3600)) ||
                  ("per-hour" === o.billingIncrement &&
                    e.instance.billingIncrementSeconds &&
                    e.instance.billingIncrementSeconds < 3600) ||
                  ("available" === o.availability && "available" !== e.availability) ||
                  ("limited" === o.availability && "available" === e.availability)
                )
                  return !1;
                if ("" !== o.maxPrice) {
                  let e = Number(o.maxPrice);
                  if (Number.isFinite(e) && null !== t && t > e) return !1;
                }
                return !0;
              }),
            [n, o],
          );
        (0, a.useEffect)(() => {
          let e = new URLSearchParams();
          ("all" !== o.region && e.set("region", o.region),
            "all" !== o.networkType && e.set("network", o.networkType),
            "all" !== o.billingIncrement && e.set("billing", o.billingIncrement),
            "all" !== o.availability && e.set("availability", o.availability),
            "" !== o.maxPrice && e.set("maxPrice", String(o.maxPrice)),
            o.showStale && e.set("showStale", "true"));
          let l =
            "" === e.toString()
              ? window.location.pathname
              : "".concat(window.location.pathname, "?").concat(e.toString());
          window.history.replaceState({}, "", l);
        }, [o]);
        let g = (e, l) => {
            c((n) => ({ ...n, [e]: l }));
          },
          b =
            "all" !== o.region ||
            "all" !== o.networkType ||
            "all" !== o.billingIncrement ||
            "all" !== o.availability ||
            "" !== o.maxPrice ||
            o.showStale,
          h = p.reduce((e, l) => {
            var n;
            let t = null != (n = l.spot) ? n : l.onDemand;
            return null === t ? e : null === e ? t : Math.min(e, t);
          }, null),
          m = (0, a.useMemo)(() => {
            var e;
            let l = p
              .map((e) => {
                var l;
                return null != (l = e.spot) ? l : e.onDemand;
              })
              .filter((e) => null !== e)
              .sort((e, l) => e - l);
            if (0 === l.length) return null;
            let n = Math.floor(l.length / 2);
            if (l.length % 2 == 0) {
              let e = l[n - 1],
                t = l[n];
              if (void 0 !== e && void 0 !== t) return (e + t) / 2;
            }
            return null != (e = l[n]) ? e : null;
          }, [p]);
        return (0, t.jsxs)("div", {
          children: [
            (0, t.jsxs)("div", {
              style: {
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
                marginBottom: 16,
              },
              children: [
                (0, t.jsx)("span", {
                  className: "muted",
                  style: { fontSize: 13, fontWeight: 600 },
                  children: "Quick filters:",
                }),
                [
                  { label: "Under $2/hr", key: "under2", maxPrice: 2 },
                  { label: "Enterprise tier only", key: "enterprise", tier: "enterprise" },
                  { label: "In stock now", key: "available", availability: "available" },
                ].map((e) =>
                  (0, t.jsx)(
                    "button",
                    {
                      className: u === e.key ? "btn" : "btn btnSecondary",
                      onClick: () => {
                        c((l) => {
                          let n = { ...l, maxPrice: "", availability: "all" };
                          return (
                            "under2" === e.key && (n.maxPrice = e.maxPrice),
                            "available" === e.key && (n.availability = "available"),
                            n
                          );
                        });
                      },
                      type: "button",
                      style: { fontSize: 13, padding: "6px 12px" },
                      children: e.label,
                    },
                    e.key,
                  ),
                ),
              ],
            }),
            (0, t.jsxs)("div", {
              className: "card",
              style: {
                padding: 14,
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              },
              children: [
                (0, t.jsxs)("label", {
                  style: { display: "grid", gap: 4 },
                  children: [
                    (0, t.jsx)("span", {
                      className: "muted",
                      style: { fontSize: 12 },
                      children: "Region",
                    }),
                    (0, t.jsxs)("select", {
                      className: "select",
                      value: o.region,
                      onChange: (e) => g("region", e.target.value),
                      style: { fontSize: 13 },
                      children: [
                        (0, t.jsx)("option", { value: "all", children: "All regions" }),
                        d.map((e) => (0, t.jsx)("option", { value: e, children: e }, e)),
                      ],
                    }),
                  ],
                }),
                (0, t.jsxs)("label", {
                  style: { display: "grid", gap: 4 },
                  children: [
                    (0, t.jsx)("span", {
                      className: "muted",
                      style: { fontSize: 12 },
                      children: "Network Type",
                    }),
                    (0, t.jsxs)("select", {
                      className: "select",
                      value: o.networkType,
                      onChange: (e) => g("networkType", e.target.value),
                      style: { fontSize: 13 },
                      children: [
                        (0, t.jsx)("option", { value: "all", children: "All" }),
                        (0, t.jsx)("option", { value: "infiniband", children: "InfiniBand only" }),
                        (0, t.jsx)("option", { value: "nvlink", children: "NVLink only" }),
                      ],
                    }),
                  ],
                }),
                (0, t.jsxs)("label", {
                  style: { display: "grid", gap: 4 },
                  children: [
                    (0, t.jsx)("span", {
                      className: "muted",
                      style: { fontSize: 12 },
                      children: "Billing Increment",
                    }),
                    (0, t.jsxs)("select", {
                      className: "select",
                      value: o.billingIncrement,
                      onChange: (e) => g("billingIncrement", e.target.value),
                      style: { fontSize: 13 },
                      children: [
                        (0, t.jsx)("option", { value: "all", children: "All" }),
                        (0, t.jsx)("option", {
                          value: "per-minute",
                          children: "Per-minute billing",
                        }),
                        (0, t.jsx)("option", { value: "per-hour", children: "Per-hour billing" }),
                      ],
                    }),
                  ],
                }),
                (0, t.jsxs)("label", {
                  style: { display: "grid", gap: 4 },
                  children: [
                    (0, t.jsx)("span", {
                      className: "muted",
                      style: { fontSize: 12 },
                      children: "Availability",
                    }),
                    (0, t.jsxs)("select", {
                      className: "select",
                      value: o.availability,
                      onChange: (e) => g("availability", e.target.value),
                      style: { fontSize: 13 },
                      children: [
                        (0, t.jsx)("option", { value: "all", children: "All" }),
                        (0, t.jsx)("option", { value: "available", children: "In stock now" }),
                        (0, t.jsx)("option", { value: "limited", children: "Limited/unknown" }),
                      ],
                    }),
                  ],
                }),
                (0, t.jsxs)("label", {
                  style: { display: "grid", gap: 4 },
                  children: [
                    (0, t.jsx)("span", {
                      className: "muted",
                      style: { fontSize: 12 },
                      children: "Max Price ($/GPU-hr)",
                    }),
                    (0, t.jsx)("input", {
                      className: "input",
                      type: "number",
                      step: "0.01",
                      min: "0",
                      placeholder: "No limit",
                      value: o.maxPrice,
                      onChange: (e) => {
                        let l = e.target.value;
                        g("maxPrice", "" === l || Number.isNaN(Number(l)) ? "" : Number(l));
                      },
                      style: { fontSize: 13 },
                    }),
                  ],
                }),
                (0, t.jsxs)("label", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    paddingTop: 18,
                    cursor: "pointer",
                  },
                  children: [
                    (0, t.jsx)("input", {
                      type: "checkbox",
                      checked: o.showStale,
                      onChange: (e) => g("showStale", e.target.checked),
                      style: { margin: 0 },
                    }),
                    (0, t.jsx)("span", {
                      className: "muted",
                      style: { fontSize: 13 },
                      children: "Show stale prices",
                    }),
                  ],
                }),
                b
                  ? (0, t.jsx)("button", {
                      className: "btn btnSecondary",
                      onClick: () => {
                        c(s);
                      },
                      type: "button",
                      style: { fontSize: 13, padding: "10px 12px", justifySelf: "start" },
                      children: "Clear filters",
                    })
                  : null,
              ],
            }),
            (0, t.jsx)("div", {
              style: { marginTop: 16 },
              children:
                0 === p.length
                  ? (0, t.jsx)("div", {
                      className: "card",
                      style: {
                        padding: 32,
                        textAlign: "center",
                        background: "rgba(15, 23, 42, 0.03)",
                      },
                      children: (0, t.jsx)("p", {
                        className: "muted",
                        style: { margin: 0 },
                        children: "No results match your filters. Try adjusting your criteria.",
                      }),
                    })
                  : (0, t.jsx)("div", {
                      style: { overflowX: "auto" },
                      children: (0, t.jsxs)("table", {
                        style: { width: "100%", borderCollapse: "collapse" },
                        children: [
                          (0, t.jsxs)("caption", {
                            children: [
                              "GPU pricing comparison for ",
                              l,
                              ". Showing ",
                              p.length,
                              " of ",
                              n.length,
                              " ",
                              "results. Prices shown per GPU per hour. On-demand prices are fixed; spot prices vary by market demand.",
                            ],
                          }),
                          (0, t.jsx)("thead", {
                            children: (0, t.jsxs)("tr", {
                              style: { textAlign: "left" },
                              children: [
                                (0, t.jsx)("th", {
                                  scope: "col",
                                  style: {
                                    padding: 12,
                                    borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
                                  },
                                  children: "Provider",
                                }),
                                (0, t.jsx)("th", {
                                  scope: "col",
                                  style: {
                                    padding: 12,
                                    borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
                                  },
                                  children: "On-demand",
                                }),
                                (0, t.jsx)("th", {
                                  scope: "col",
                                  style: {
                                    padding: 12,
                                    borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
                                  },
                                  children: "Spot",
                                }),
                                (0, t.jsx)("th", {
                                  scope: "col",
                                  style: {
                                    padding: 12,
                                    borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
                                  },
                                  children: "Details",
                                }),
                                (0, t.jsx)("th", {
                                  scope: "col",
                                  style: {
                                    padding: 12,
                                    borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
                                  },
                                  children: "Updated",
                                }),
                                (0, t.jsx)("th", {
                                  scope: "col",
                                  style: {
                                    padding: 12,
                                    borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
                                  },
                                }),
                              ],
                            }),
                          }),
                          (0, t.jsx)("tbody", {
                            children: p.map((e) => {
                              var n, a, s;
                              let o = [];
                              (e.instance.hasNvlink && o.push("NVLink"),
                                e.instance.hasInfiniband &&
                                  o.push(
                                    e.instance.infinibandBandwidthGbps
                                      ? "InfiniBand ".concat(
                                          e.instance.infinibandBandwidthGbps,
                                          "Gbps",
                                        )
                                      : "InfiniBand",
                                  ),
                                null != e.instance.networkBandwidthGbps &&
                                  o.push("".concat(e.instance.networkBandwidthGbps, "Gbps net")));
                              let c =
                                  null == (s = e.instance.billingIncrementSeconds) ||
                                  !Number.isFinite(s) ||
                                  s <= 0
                                    ? null
                                    : s % 3600 == 0
                                      ? "".concat(s / 3600, "h")
                                      : s % 60 == 0
                                        ? "".concat(s / 60, "m")
                                        : "".concat(s, "s"),
                                d = [];
                              (null != e.instance.minRentalHours &&
                                e.instance.minRentalHours > 1 &&
                                d.push("".concat(e.instance.minRentalHours, "h min")),
                                c && d.push("".concat(c, " inc")));
                              let u = new Date(e.lastUpdated).getTime(),
                                p = Number.isFinite(u) ? (Date.now() - u) / 36e5 : null,
                                g =
                                  null == p
                                    ? null
                                    : p < 6
                                      ? { label: "Fresh", color: "rgb(6, 95, 70)" }
                                      : p < 24
                                        ? { label: "OK", color: "rgb(120, 113, 108)" }
                                        : p < 48
                                          ? { label: "Stale", color: "rgb(180, 83, 9)" }
                                          : { label: "Very stale", color: "rgb(185, 28, 28)" },
                                b =
                                  (null != (n = e.spot) ? n : e.onDemand) !== null &&
                                  null !== h &&
                                  (null != (a = e.spot) ? a : e.onDemand) === h;
                              return (0, t.jsxs)(
                                "tr",
                                {
                                  className: "price-row".concat(b ? " cheapest-row" : ""),
                                  style: g ? { borderLeft: "3px solid ".concat(g.color) } : void 0,
                                  children: [
                                    (0, t.jsxs)("td", {
                                      style: {
                                        padding: 12,
                                        borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
                                      },
                                      children: [
                                        (0, t.jsxs)("div", {
                                          style: {
                                            fontWeight: 700,
                                            display: "flex",
                                            alignItems: "center",
                                            flexWrap: "wrap",
                                          },
                                          children: [
                                            e.provider.name,
                                            b &&
                                              (0, t.jsx)("span", {
                                                style: {
                                                  display: "inline-block",
                                                  background:
                                                    "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                                                  color: "white",
                                                  fontSize: 10,
                                                  fontWeight: 700,
                                                  padding: "2px 6px",
                                                  borderRadius: 4,
                                                  marginLeft: 8,
                                                  textTransform: "uppercase",
                                                  letterSpacing: "0.5px",
                                                },
                                                children: "Best Deal",
                                              }),
                                          ],
                                        }),
                                        (0, t.jsx)("div", {
                                          style: { fontSize: 12, marginTop: 2 },
                                          children: (() => {
                                            var l;
                                            let n = e.provider.reliabilityTier.toLowerCase(),
                                              a = {
                                                enterprise: {
                                                  bg: "rgba(59, 130, 246, 0.12)",
                                                  color: "rgb(37, 99, 235)",
                                                  border: "rgba(59, 130, 246, 0.35)",
                                                },
                                                standard: {
                                                  bg: "rgba(107, 114, 128, 0.12)",
                                                  color: "rgb(75, 85, 99)",
                                                  border: "rgba(107, 114, 128, 0.35)",
                                                },
                                                community: {
                                                  bg: "rgba(249, 115, 22, 0.12)",
                                                  color: "rgb(194, 65, 12)",
                                                  border: "rgba(249, 115, 22, 0.35)",
                                                },
                                                depin: {
                                                  bg: "rgba(249, 115, 22, 0.12)",
                                                  color: "rgb(194, 65, 12)",
                                                  border: "rgba(249, 115, 22, 0.35)",
                                                },
                                              },
                                              i = null != (l = a[n]) ? l : a.standard;
                                            return i
                                              ? (0, t.jsx)("span", {
                                                  style: {
                                                    display: "inline-block",
                                                    background: i.bg,
                                                    color: i.color,
                                                    border: "1px solid ".concat(i.border),
                                                    fontSize: 10,
                                                    fontWeight: 600,
                                                    padding: "2px 6px",
                                                    borderRadius: 4,
                                                    textTransform: "capitalize",
                                                  },
                                                  children: e.provider.reliabilityTier,
                                                })
                                              : null;
                                          })(),
                                        }),
                                      ],
                                    }),
                                    (0, t.jsx)("td", {
                                      style: {
                                        padding: 12,
                                        borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
                                      },
                                      children: (0, r.b)(e.onDemand),
                                    }),
                                    (0, t.jsx)("td", {
                                      style: {
                                        padding: 12,
                                        borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
                                      },
                                      children: (0, t.jsxs)("div", {
                                        style: {
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 6,
                                          flexWrap: "wrap",
                                        },
                                        children: [
                                          (0, r.b)(e.spot),
                                          (() => {
                                            var l;
                                            let n = null != (l = e.spot) ? l : e.onDemand;
                                            if (null === n || null === m || m <= 0) return null;
                                            let a = Math.round(((m - n) / m) * 100);
                                            return a < 15
                                              ? null
                                              : (0, t.jsxs)("span", {
                                                  style: {
                                                    display: "inline-block",
                                                    background: "rgba(16, 185, 129, 0.12)",
                                                    color: "rgb(6, 95, 70)",
                                                    border: "1px solid rgba(16, 185, 129, 0.35)",
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    padding: "2px 5px",
                                                    borderRadius: 4,
                                                  },
                                                  children: [a, "% below avg"],
                                                });
                                          })(),
                                        ],
                                      }),
                                    }),
                                    (0, t.jsxs)("td", {
                                      style: {
                                        padding: 12,
                                        borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
                                      },
                                      children: [
                                        (0, t.jsxs)("div", {
                                          style: { fontSize: 13 },
                                          children: [
                                            (0, t.jsx)("span", {
                                              style: { fontWeight: 700 },
                                              children: e.instance.instanceType,
                                            }),
                                            " ",
                                            (0, t.jsxs)("span", {
                                              className: "muted",
                                              children: ["\xb7 ", e.instance.gpuCount, "\xd7GPU"],
                                            }),
                                          ],
                                        }),
                                        (0, t.jsxs)("div", {
                                          className: "muted",
                                          style: { fontSize: 12, marginTop: 4, lineHeight: 1.6 },
                                          children: [
                                            (0, t.jsxs)("div", {
                                              children: [
                                                "Network: ",
                                                o.length ? o.join(" \xb7 ") : "—",
                                              ],
                                            }),
                                            (0, t.jsxs)("div", {
                                              children: [
                                                "Billing: ",
                                                d.length ? d.join(" \xb7 ") : "—",
                                              ],
                                            }),
                                          ],
                                        }),
                                      ],
                                    }),
                                    (0, t.jsxs)("td", {
                                      style: {
                                        padding: 12,
                                        borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
                                      },
                                      children: [
                                        (0, t.jsxs)("div", {
                                          style: { display: "flex", alignItems: "center", gap: 6 },
                                          children: [
                                            g
                                              ? (0, t.jsx)("span", {
                                                  className: "badge",
                                                  style: {
                                                    fontSize: 10,
                                                    padding: "2px 6px",
                                                    background: "rgba(".concat(
                                                      "rgb(6, 95, 70)" === g.color
                                                        ? "16, 185, 129"
                                                        : "rgb(120, 113, 108)" === g.color
                                                          ? "120, 113, 108"
                                                          : "rgb(180, 83, 9)" === g.color
                                                            ? "251, 146, 60"
                                                            : "239, 68, 68",
                                                      ", 0.15)",
                                                    ),
                                                    color: g.color,
                                                    borderColor: "rgba(".concat(
                                                      "rgb(6, 95, 70)" === g.color
                                                        ? "16, 185, 129"
                                                        : "rgb(120, 113, 108)" === g.color
                                                          ? "120, 113, 108"
                                                          : "rgb(180, 83, 9)" === g.color
                                                            ? "251, 146, 60"
                                                            : "239, 68, 68",
                                                      ", 0.4)",
                                                    ),
                                                  },
                                                  children: g.label,
                                                })
                                              : null,
                                            (0, t.jsx)("span", {
                                              className: "muted",
                                              style: { fontSize: 13 },
                                              children: (0, r.f)(e.lastUpdated),
                                            }),
                                          ],
                                        }),
                                        (0, t.jsx)("div", {
                                          className: "muted",
                                          style: { fontSize: 12, marginTop: 4 },
                                          children: new Date(e.lastUpdated).toLocaleString(),
                                        }),
                                      ],
                                    }),
                                    (0, t.jsx)("td", {
                                      style: {
                                        padding: 12,
                                        borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
                                        textAlign: "right",
                                      },
                                      children: (0, t.jsxs)("a", {
                                        className: "btn",
                                        href: (0, i.DR)({
                                          providerSlug: e.provider.slug,
                                          gpuSlug: l,
                                        }),
                                        target: "_blank",
                                        rel: "noopener nofollow",
                                        style: b
                                          ? {
                                              background:
                                                "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                                              borderColor: "#16a34a",
                                            }
                                          : void 0,
                                        children: [
                                          b ? "Get This Deal" : "View offer",
                                          (0, t.jsx)("svg", {
                                            width: "12",
                                            height: "12",
                                            viewBox: "0 0 12 12",
                                            fill: "none",
                                            style: { marginLeft: 4 },
                                            children: (0, t.jsx)("path", {
                                              d: "M3.5 2.5H9.5V8.5M9.5 2.5L2.5 9.5",
                                              stroke: "currentColor",
                                              strokeWidth: "1.5",
                                              strokeLinecap: "round",
                                              strokeLinejoin: "round",
                                            }),
                                          }),
                                        ],
                                      }),
                                    }),
                                  ],
                                },
                                e.provider.slug,
                              );
                            }),
                          }),
                        ],
                      }),
                    }),
            }),
          ],
        });
      }
    },
    7621: (e, l, n) => {
      n.d(l, {
        DR: () => o,
        O5: () => a,
        Tp: () => i,
        Wt: () => s,
        Yk: () => r,
        iD: () => u,
        jp: () => p,
        kz: () => d,
        qu: () => h,
        rc: () => g,
        tD: () => b,
      });
      var t = n(3850);
      function a(e) {
        localStorage.setItem("auth_token", e);
      }
      function i() {
        localStorage.removeItem("auth_token");
      }
      function r() {
        let e = localStorage.getItem("auth_user");
        return e ? JSON.parse(e) : null;
      }
      function s(e) {
        e
          ? localStorage.setItem("auth_user", JSON.stringify(e))
          : localStorage.removeItem("auth_user");
      }
      function o(e) {
        let l = new URL("/api/affiliate/click", t._.apiBaseUrl);
        return (
          l.searchParams.set("provider", e.providerSlug),
          e.gpuSlug && l.searchParams.set("gpu", e.gpuSlug),
          l.searchParams.set("utm_source", "cloudgpus.io"),
          l.searchParams.set("utm_medium", "referral"),
          l.toString()
        );
      }
      async function c(e, l) {
        let n = new URL(e, t._.apiBaseUrl),
          a = localStorage.getItem("auth_token"),
          i = { accept: "application/json", "content-type": "application/json" };
        (a && (i.authorization = "Bearer ".concat(a)),
          (null == l ? void 0 : l.headers) && Object.assign(i, l.headers));
        let r = await fetch(n.toString(), { ...l, headers: i });
        if (!r.ok) {
          let e = await r.json().catch(() => ({ error: "Unknown error" }));
          throw Error(e.error || e.message || "API ".concat(r.status));
        }
        return await r.json();
      }
      async function d(e, l, n) {
        return c("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ email: e, password: l, name: n }),
        });
      }
      async function u(e, l) {
        return c("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: e, password: l }),
        });
      }
      async function p() {
        return c("/api/me", { method: "GET" });
      }
      async function g() {
        return c("/api/me/comparisons", { method: "GET" });
      }
      async function b(e) {
        return c("/api/me/comparisons/".concat(e), { method: "DELETE" });
      }
      async function h() {
        return c("/api/me/alerts", { method: "GET" });
      }
    },
  },
]);
