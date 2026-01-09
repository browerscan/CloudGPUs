(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [298],
  {
    4516: (e, t, s) => {
      Promise.resolve().then(s.bind(s, 8314));
    },
    8314: (e, t, s) => {
      "use strict";
      (s.r(t), s.d(t, { default: () => d }));
      var i = s(5155),
        n = s(2115),
        r = s(7621),
        a = s(3547);
      function d() {
        var e;
        let [t, s] = (0, n.useState)((0, r.Yk)()),
          [d, l] = (0, n.useState)([]),
          [o, c] = (0, n.useState)([]),
          [p, m] = (0, n.useState)(!0),
          [x, h] = (0, n.useState)("overview"),
          [g, u] = (0, n.useState)(!1),
          v = null != (e = null == t ? void 0 : t.id) ? e : null;
        (0, n.useEffect)(() => {
          if (!v) return void m(!1);
          Promise.all([(0, r.jp)(), (0, r.rc)(), (0, r.qu)()])
            .then((e) => {
              let [t, i, n] = e;
              (s(t.data.user), l(i.data.comparisons), c(n.data.alerts));
            })
            .catch(() => {
              ((0, r.Tp)(), (0, r.Wt)(null), s(null));
            })
            .finally(() => m(!1));
        }, [v]);
        let j = async (e) => {
          try {
            (await (0, r.tD)(e), l((t) => t.filter((t) => t.id !== e)));
          } catch (e) {
            console.error("Failed to delete comparison:", e);
          }
        };
        return p
          ? (0, i.jsx)("div", {
              className: "container",
              style: { padding: "40px 20px", textAlign: "center" },
              children: (0, i.jsx)("p", { children: "Loading..." }),
            })
          : t
            ? (0, i.jsxs)("div", {
                className: "container",
                style: { padding: "40px 20px" },
                children: [
                  (0, i.jsxs)("div", {
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 32,
                    },
                    children: [
                      (0, i.jsxs)("div", {
                        children: [
                          (0, i.jsx)("h1", {
                            style: { margin: 0, marginBottom: 8 },
                            children: "My Account",
                          }),
                          (0, i.jsxs)("p", {
                            className: "muted",
                            style: { margin: 0 },
                            children: [
                              t.email,
                              !t.isVerified &&
                                (0, i.jsx)("span", {
                                  style: { color: "var(--warning, #c60)", marginLeft: 8 },
                                  children: "(Email not verified)",
                                }),
                            ],
                          }),
                        ],
                      }),
                      (0, i.jsx)("button", {
                        onClick: () => {
                          ((0, r.Tp)(), (0, r.Wt)(null), s(null), l([]), c([]));
                        },
                        className: "btn btnSecondary",
                        children: "Sign Out",
                      }),
                    ],
                  }),
                  (0, i.jsxs)("div", {
                    className: "card",
                    style: { padding: 0, overflow: "hidden" },
                    children: [
                      (0, i.jsxs)("div", {
                        style: {
                          display: "flex",
                          borderBottom: "1px solid var(--border)",
                          background: "var(--muted-bg, #f5f5f5)",
                        },
                        children: [
                          (0, i.jsx)("button", {
                            onClick: () => h("overview"),
                            style: {
                              padding: "16px 24px",
                              background: "overview" === x ? "var(--bg)" : "transparent",
                              border: "none",
                              borderBottom:
                                "overview" === x ? "2px solid var(--link, #0066cc)" : "none",
                              cursor: "pointer",
                              fontWeight: "overview" === x ? 600 : 400,
                            },
                            children: "Overview",
                          }),
                          (0, i.jsxs)("button", {
                            onClick: () => h("comparisons"),
                            style: {
                              padding: "16px 24px",
                              background: "comparisons" === x ? "var(--bg)" : "transparent",
                              border: "none",
                              borderBottom:
                                "comparisons" === x ? "2px solid var(--link, #0066cc)" : "none",
                              cursor: "pointer",
                              fontWeight: "comparisons" === x ? 600 : 400,
                            },
                            children: ["Saved Comparisons (", d.length, ")"],
                          }),
                          (0, i.jsxs)("button", {
                            onClick: () => h("alerts"),
                            style: {
                              padding: "16px 24px",
                              background: "alerts" === x ? "var(--bg)" : "transparent",
                              border: "none",
                              borderBottom:
                                "alerts" === x ? "2px solid var(--link, #0066cc)" : "none",
                              cursor: "pointer",
                              fontWeight: "alerts" === x ? 600 : 400,
                            },
                            children: ["Price Alerts (", o.length, ")"],
                          }),
                        ],
                      }),
                      (0, i.jsxs)("div", {
                        style: { padding: 24 },
                        children: [
                          "overview" === x &&
                            (0, i.jsxs)("div", {
                              children: [
                                (0, i.jsx)("h2", {
                                  style: { fontSize: 18, marginBottom: 16 },
                                  children: "Account Overview",
                                }),
                                (0, i.jsxs)("dl", {
                                  style: {
                                    display: "grid",
                                    gridTemplateColumns: "auto 1fr",
                                    gap: "8px 16px",
                                  },
                                  children: [
                                    (0, i.jsx)("dt", { className: "muted", children: "Email:" }),
                                    (0, i.jsx)("dd", { children: t.email }),
                                    (0, i.jsx)("dt", { className: "muted", children: "Name:" }),
                                    (0, i.jsx)("dd", { children: t.name || "Not set" }),
                                    (0, i.jsx)("dt", { className: "muted", children: "Status:" }),
                                    (0, i.jsx)("dd", {
                                      children: t.isVerified ? "Verified" : "Pending verification",
                                    }),
                                    t.createdAt &&
                                      (0, i.jsxs)(i.Fragment, {
                                        children: [
                                          (0, i.jsx)("dt", {
                                            className: "muted",
                                            children: "Member since:",
                                          }),
                                          (0, i.jsx)("dd", {
                                            children: new Date(t.createdAt).toLocaleDateString(),
                                          }),
                                        ],
                                      }),
                                    t.lastLoginAt &&
                                      (0, i.jsxs)(i.Fragment, {
                                        children: [
                                          (0, i.jsx)("dt", {
                                            className: "muted",
                                            children: "Last login:",
                                          }),
                                          (0, i.jsx)("dd", {
                                            children: new Date(t.lastLoginAt).toLocaleString(),
                                          }),
                                        ],
                                      }),
                                  ],
                                }),
                              ],
                            }),
                          "comparisons" === x &&
                            (0, i.jsxs)("div", {
                              children: [
                                (0, i.jsx)("h2", {
                                  style: { fontSize: 18, marginBottom: 16 },
                                  children: "Saved Comparisons",
                                }),
                                0 === d.length
                                  ? (0, i.jsx)("p", {
                                      className: "muted",
                                      children:
                                        "No saved comparisons yet. Use the compare page to save comparisons.",
                                    })
                                  : (0, i.jsx)("div", {
                                      style: { display: "flex", flexDirection: "column", gap: 12 },
                                      children: d.map((e) =>
                                        (0, i.jsxs)(
                                          "div",
                                          {
                                            style: {
                                              padding: 16,
                                              border: "1px solid var(--border)",
                                              borderRadius: 8,
                                              display: "flex",
                                              justifyContent: "space-between",
                                              alignItems: "center",
                                            },
                                            children: [
                                              (0, i.jsxs)("div", {
                                                children: [
                                                  (0, i.jsx)("div", {
                                                    style: { fontWeight: 600, marginBottom: 4 },
                                                    children:
                                                      e.name ||
                                                      "".concat(e.comparisonType, " comparison"),
                                                  }),
                                                  (0, i.jsxs)("div", {
                                                    className: "muted",
                                                    style: { fontSize: 14 },
                                                    children: [
                                                      "gpu" === e.comparisonType
                                                        ? "GPU"
                                                        : "Provider",
                                                      " comparison",
                                                      " \xb7 ",
                                                      new Date(e.updatedAt).toLocaleDateString(),
                                                    ],
                                                  }),
                                                ],
                                              }),
                                              (0, i.jsx)("button", {
                                                onClick: () => j(e.id),
                                                className: "btn btnSecondary",
                                                style: { padding: "8px 16px", fontSize: 14 },
                                                children: "Delete",
                                              }),
                                            ],
                                          },
                                          e.id,
                                        ),
                                      ),
                                    }),
                              ],
                            }),
                          "alerts" === x &&
                            (0, i.jsxs)("div", {
                              children: [
                                (0, i.jsx)("h2", {
                                  style: { fontSize: 18, marginBottom: 16 },
                                  children: "Price Alerts",
                                }),
                                0 === o.length
                                  ? (0, i.jsx)("p", {
                                      className: "muted",
                                      children:
                                        "No price alerts yet. Set up alerts to get notified of price drops.",
                                    })
                                  : (0, i.jsx)("div", {
                                      style: { display: "flex", flexDirection: "column", gap: 12 },
                                      children: o.map((e) =>
                                        (0, i.jsx)(
                                          "div",
                                          {
                                            style: {
                                              padding: 16,
                                              border: "1px solid var(--border)",
                                              borderRadius: 8,
                                            },
                                            children: (0, i.jsxs)("div", {
                                              style: {
                                                display: "flex",
                                                justifyContent: "space-between",
                                              },
                                              children: [
                                                (0, i.jsxs)("div", {
                                                  children: [
                                                    (0, i.jsxs)("div", {
                                                      style: { fontWeight: 600, marginBottom: 4 },
                                                      children: [
                                                        e.gpu.name,
                                                        e.provider && " @ ".concat(e.provider.name),
                                                      ],
                                                    }),
                                                    (0, i.jsxs)("div", {
                                                      className: "muted",
                                                      style: { fontSize: 14 },
                                                      children: [
                                                        "Target: $",
                                                        e.targetPricePerGpuHour.toFixed(4),
                                                        "/GPU-hour",
                                                        " \xb7 ",
                                                        e.isActive ? "Active" : "Inactive",
                                                        " \xb7 ",
                                                        new Date(e.createdAt).toLocaleDateString(),
                                                      ],
                                                    }),
                                                  ],
                                                }),
                                                null === e.confirmedAt &&
                                                  (0, i.jsx)("span", {
                                                    style: {
                                                      fontSize: 12,
                                                      color: "var(--warning, #c60)",
                                                    },
                                                    children: "Pending",
                                                  }),
                                              ],
                                            }),
                                          },
                                          e.id,
                                        ),
                                      ),
                                    }),
                              ],
                            }),
                        ],
                      }),
                    ],
                  }),
                ],
              })
            : (0, i.jsx)("div", {
                className: "container",
                style: { padding: "40px 20px", maxWidth: 600 },
                children: (0, i.jsxs)("div", {
                  className: "card",
                  style: { padding: 40, textAlign: "center" },
                  children: [
                    (0, i.jsx)("h1", { style: { marginBottom: 16 }, children: "Sign In Required" }),
                    (0, i.jsx)("p", {
                      className: "muted",
                      style: { marginBottom: 24 },
                      children: "Please sign in to access your account dashboard.",
                    }),
                    (0, i.jsx)(a.LoginButton, {
                      onLoginSuccess: (e) => {
                        (s(e), u(!1));
                      },
                    }),
                  ],
                }),
              });
      }
    },
  },
  (e) => {
    (e.O(0, [547, 441, 255, 358], () => e((e.s = 4516))), (_N_E = e.O()));
  },
]);
