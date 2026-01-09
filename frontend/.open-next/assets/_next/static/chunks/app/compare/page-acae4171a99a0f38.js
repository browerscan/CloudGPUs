(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [402],
  {
    1123: (e, s, l) => {
      (Promise.resolve().then(l.bind(l, 6746)), Promise.resolve().then(l.t.bind(l, 2619, 23)));
    },
    6746: (e, s, l) => {
      "use strict";
      l.d(s, { CompareBuilder: () => t });
      var n = l(5155),
        i = l(2115),
        a = l(7260);
      function t(e) {
        var s, l, t, r;
        let { providers: d, gpus: o } = e,
          c = (0, a.useRouter)(),
          u = d.length >= 2 ? "providers" : o.length >= 2 ? "gpus" : "providers",
          [p, g] = (0, i.useState)(u),
          h = "providers" === p ? d : o,
          [m, v] = (0, i.useState)(null != (t = null == (s = h[0]) ? void 0 : s.slug) ? t : ""),
          [b, x] = (0, i.useState)(null != (r = null == (l = h[1]) ? void 0 : l.slug) ? r : ""),
          y = (0, i.useMemo)(() => m && b && m !== b, [m, b]);
        function f(e) {
          var s, l, n, i;
          g(e);
          let a = "providers" === e ? d : o;
          a.length < 2 ||
            (v(null != (n = null == (s = a[0]) ? void 0 : s.slug) ? n : ""),
            x(null != (i = null == (l = a[1]) ? void 0 : l.slug) ? i : ""));
        }
        return d.length < 2 && o.length < 2
          ? (0, n.jsxs)("div", {
              className: "card",
              style: { padding: 16 },
              children: [
                (0, n.jsx)("div", {
                  style: { fontWeight: 800 },
                  children: "Comparison builder unavailable",
                }),
                (0, n.jsxs)("div", {
                  className: "muted",
                  style: { marginTop: 8, lineHeight: 1.7 },
                  children: [
                    "We couldn’t load provider/GPU catalogs from the API. Configure",
                    " ",
                    (0, n.jsx)("code", { children: "NEXT_PUBLIC_API_BASE_URL" }),
                    " and refresh.",
                  ],
                }),
              ],
            })
          : (0, n.jsxs)("form", {
              onSubmit: function (e) {
                (e.preventDefault(),
                  y &&
                    c.push(
                      "/compare/".concat(
                        (function (e, s) {
                          let [l, n] = [e, s].sort();
                          return "".concat(l, "-vs-").concat(n);
                        })(m, b),
                      ),
                    ));
              },
              className: "card",
              style: { padding: 16 },
              children: [
                (0, n.jsx)("div", { style: { fontWeight: 800 }, children: "Build a comparison" }),
                (0, n.jsx)("div", {
                  className: "muted",
                  style: { marginTop: 6, lineHeight: 1.6, fontSize: 13 },
                  children:
                    "Compare providers side‑by‑side (pricing, features, reliability) or compare two GPUs (specs + live price ranges).",
                }),
                (0, n.jsxs)("div", {
                  style: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 },
                  children: [
                    (0, n.jsx)("button", {
                      type: "button",
                      className: "btn ".concat("providers" === p ? "" : "btnSecondary"),
                      onClick: () => f("providers"),
                      disabled: d.length < 2,
                      children: "Providers",
                    }),
                    (0, n.jsx)("button", {
                      type: "button",
                      className: "btn ".concat("gpus" === p ? "" : "btnSecondary"),
                      onClick: () => f("gpus"),
                      disabled: o.length < 2,
                      children: "GPUs",
                    }),
                  ],
                }),
                (0, n.jsxs)("div", {
                  className: "grid grid2",
                  style: { marginTop: 12, alignItems: "end" },
                  children: [
                    (0, n.jsxs)("label", {
                      style: { display: "grid", gap: 6 },
                      children: [
                        (0, n.jsx)("span", {
                          className: "muted",
                          style: { fontSize: 13 },
                          children: "A",
                        }),
                        (0, n.jsx)("select", {
                          value: m,
                          onChange: (e) => v(e.target.value),
                          disabled: h.length < 2,
                          style: {
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "1px solid rgba(15, 23, 42, 0.12)",
                          },
                          children: h.map((e) =>
                            (0, n.jsx)("option", { value: e.slug, children: e.name }, e.slug),
                          ),
                        }),
                      ],
                    }),
                    (0, n.jsxs)("label", {
                      style: { display: "grid", gap: 6 },
                      children: [
                        (0, n.jsx)("span", {
                          className: "muted",
                          style: { fontSize: 13 },
                          children: "B",
                        }),
                        (0, n.jsx)("select", {
                          value: b,
                          onChange: (e) => x(e.target.value),
                          disabled: h.length < 2,
                          style: {
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "1px solid rgba(15, 23, 42, 0.12)",
                          },
                          children: h.map((e) =>
                            (0, n.jsx)("option", { value: e.slug, children: e.name }, e.slug),
                          ),
                        }),
                      ],
                    }),
                  ],
                }),
                (0, n.jsxs)("div", {
                  style: {
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                    marginTop: 12,
                  },
                  children: [
                    (0, n.jsx)("button", {
                      className: "btn",
                      type: "submit",
                      disabled: !y,
                      children: "Compare",
                    }),
                    y
                      ? null
                      : (0, n.jsx)("span", {
                          className: "muted",
                          style: { fontSize: 13 },
                          children: "Pick two different options.",
                        }),
                  ],
                }),
              ],
            });
      }
    },
  },
  (e) => {
    (e.O(0, [0, 441, 255, 358], () => e((e.s = 1123))), (_N_E = e.O()));
  },
]);
