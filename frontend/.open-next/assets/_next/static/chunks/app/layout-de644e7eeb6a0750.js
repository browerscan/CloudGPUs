(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [177],
  {
    18: (e, t, n) => {
      "use strict";
      n.d(t, { CookieConsent: () => s });
      var r = n(5155),
        o = n(2115);
      let l = "cloudgpus_cookie_consent";
      function s() {
        let [e, t] = (0, o.useState)(!1),
          [n, s] = (0, o.useState)(null);
        return ((0, o.useEffect)(() => {
          let e = localStorage.getItem(l);
          "all" === e || "essential" === e ? (s(e), t(!1)) : t(!0);
        }, []),
        e)
          ? (0, r.jsxs)("div", {
              role: "dialog",
              "aria-label": "Cookie consent",
              style: {
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                padding: "16px 24px",
                background: "rgba(11, 18, 32, 0.98)",
                borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                backdropFilter: "blur(8px)",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 16,
              },
              children: [
                (0, r.jsxs)("div", {
                  style: { flex: "1 1 400px", color: "rgba(255, 255, 255, 0.85)", fontSize: 14 },
                  children: [
                    (0, r.jsx)("div", {
                      style: { fontWeight: 600, marginBottom: 4 },
                      children: "We use cookies",
                    }),
                    (0, r.jsx)("div", {
                      style: { lineHeight: 1.6, color: "rgba(255, 255, 255, 0.65)" },
                      children:
                        "We use essential cookies for site functionality and optional analytics cookies to improve your experience. You can accept all cookies or reject non-essential ones.",
                    }),
                  ],
                }),
                (0, r.jsxs)("div", {
                  style: { display: "flex", gap: 10, flexWrap: "wrap" },
                  children: [
                    (0, r.jsx)("button", {
                      onClick: () => {
                        (localStorage.setItem(l, "essential"), s("essential"), t(!1));
                      },
                      style: {
                        padding: "10px 20px",
                        borderRadius: 8,
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        background: "transparent",
                        color: "rgba(255, 255, 255, 0.85)",
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 500,
                      },
                      children: "Reject Non-Essential",
                    }),
                    (0, r.jsx)("button", {
                      onClick: () => {
                        (localStorage.setItem(l, "all"), s("all"), t(!1));
                      },
                      style: {
                        padding: "10px 20px",
                        borderRadius: 8,
                        border: "none",
                        background: "#2563eb",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 600,
                      },
                      children: "Accept All",
                    }),
                  ],
                }),
              ],
            })
          : null;
      }
    },
    1150: (e, t, n) => {
      "use strict";
      (Object.defineProperty(t, "__esModule", { value: !0 }),
        Object.defineProperty(t, "default", {
          enumerable: !0,
          get: function () {
            return i;
          },
        }));
      let r = n(5155),
        o = n(2115),
        l = n(4437);
      function s(e) {
        return { default: e && "default" in e ? e.default : e };
      }
      n(6552);
      let a = { loader: () => Promise.resolve(s(() => null)), loading: null, ssr: !0 },
        i = function (e) {
          let t = { ...a, ...e },
            n = (0, o.lazy)(() => t.loader().then(s)),
            i = t.loading;
          function c(e) {
            let s = i ? (0, r.jsx)(i, { isLoading: !0, pastDelay: !0, error: null }) : null,
              a = !t.ssr || !!t.loading,
              c = a ? o.Suspense : o.Fragment,
              d = t.ssr
                ? (0, r.jsxs)(r.Fragment, { children: [null, (0, r.jsx)(n, { ...e })] })
                : (0, r.jsx)(l.BailoutToCSR, {
                    reason: "next/dynamic",
                    children: (0, r.jsx)(n, { ...e }),
                  });
            return (0, r.jsx)(c, { ...(a ? { fallback: s } : {}), children: d });
          }
          return ((c.displayName = "LoadableComponent"), c);
        };
    },
    1290: () => {},
    1820: (e, t, n) => {
      (Promise.resolve().then(n.t.bind(n, 1290, 23)),
        Promise.resolve().then(n.bind(n, 18)),
        Promise.resolve().then(n.bind(n, 6535)),
        Promise.resolve().then(n.t.bind(n, 2619, 23)));
    },
    4054: (e, t) => {
      "use strict";
      (Object.defineProperty(t, "__esModule", { value: !0 }),
        !(function (e, t) {
          for (var n in t) Object.defineProperty(e, n, { enumerable: !0, get: t[n] });
        })(t, {
          bindSnapshot: function () {
            return s;
          },
          createAsyncLocalStorage: function () {
            return l;
          },
          createSnapshot: function () {
            return a;
          },
        }));
      let n = Object.defineProperty(
        Error("Invariant: AsyncLocalStorage accessed in runtime where it is not available"),
        "__NEXT_ERROR_CODE",
        { value: "E504", enumerable: !1, configurable: !0 },
      );
      class r {
        disable() {
          throw n;
        }
        getStore() {}
        run() {
          throw n;
        }
        exit() {
          throw n;
        }
        enterWith() {
          throw n;
        }
        static bind(e) {
          return e;
        }
      }
      let o = "undefined" != typeof globalThis && globalThis.AsyncLocalStorage;
      function l() {
        return o ? new o() : new r();
      }
      function s(e) {
        return o ? o.bind(e) : r.bind(e);
      }
      function a() {
        return o
          ? o.snapshot()
          : function (e, ...t) {
              return e(...t);
            };
      }
    },
    4437: (e, t, n) => {
      "use strict";
      function r(e) {
        let { reason: t, children: n } = e;
        return n;
      }
      (Object.defineProperty(t, "__esModule", { value: !0 }),
        Object.defineProperty(t, "BailoutToCSR", {
          enumerable: !0,
          get: function () {
            return r;
          },
        }),
        n(4553));
    },
    6278: (e, t, n) => {
      "use strict";
      (Object.defineProperty(t, "__esModule", { value: !0 }),
        Object.defineProperty(t, "default", {
          enumerable: !0,
          get: function () {
            return o;
          },
        }));
      let r = n(8140)._(n(1150));
      function o(e, t) {
        var n;
        let o = {};
        "function" == typeof e && (o.loader = e);
        let l = { ...o, ...t };
        return (0, r.default)({
          ...l,
          modules: null == (n = l.loadableGenerated) ? void 0 : n.modules,
        });
      }
      ("function" == typeof t.default || ("object" == typeof t.default && null !== t.default)) &&
        void 0 === t.default.__esModule &&
        (Object.defineProperty(t.default, "__esModule", { value: !0 }),
        Object.assign(t.default, t),
        (e.exports = t.default));
    },
    6535: (e, t, n) => {
      "use strict";
      n.d(t, { Header: () => f });
      var r = n(5155),
        o = n(2115),
        l = n(6278),
        s = n.n(l),
        a = n(2619),
        i = n.n(a),
        c = n(7621),
        d = n(3547);
      let u = s()(
        () =>
          Promise.resolve()
            .then(n.bind(n, 3547))
            .then((e) => ({ default: e.AuthModal })),
        { loadableGenerated: { webpack: () => [3547] }, loading: () => null, ssr: !1 },
      );
      function f() {
        let [e, t] = (0, o.useState)((0, c.Yk)()),
          [n, l] = (0, o.useState)(!1),
          [s, a] = (0, o.useState)(!1);
        return (
          (0, o.useEffect)(() => {
            let e = () => {
              t((0, c.Yk)());
            };
            return (
              window.addEventListener("storage", e),
              () => window.removeEventListener("storage", e)
            );
          }, []),
          (0, r.jsxs)(r.Fragment, {
            children: [
              (0, r.jsx)("header", {
                className: "card",
                style: { borderRadius: 0, borderLeft: 0, borderRight: 0 },
                children: (0, r.jsxs)("div", {
                  className: "container",
                  style: { display: "flex", gap: 16, alignItems: "center" },
                  children: [
                    (0, r.jsx)(i(), {
                      href: "/",
                      style: { fontWeight: 800, letterSpacing: "-0.02em" },
                      children: "CloudGPUs.io",
                    }),
                    (0, r.jsxs)("button", {
                      className: "mobile-menu-toggle",
                      "aria-label": "Toggle navigation menu",
                      "aria-expanded": s,
                      onClick: () => a(!s),
                      children: [
                        (0, r.jsx)("span", {}),
                        (0, r.jsx)("span", {}),
                        (0, r.jsx)("span", {}),
                      ],
                    }),
                    (0, r.jsxs)("nav", {
                      "aria-label": "Main navigation",
                      "data-expanded": s,
                      className: "muted",
                      style: { display: "flex", gap: 12, fontSize: 14 },
                      children: [
                        (0, r.jsx)(i(), { href: "/cloud-gpu", children: "GPUs" }),
                        (0, r.jsx)(i(), { href: "/provider", children: "Providers" }),
                        (0, r.jsx)(i(), { href: "/compare", children: "Compare" }),
                        (0, r.jsx)(i(), { href: "/best-gpu-for", children: "Use cases" }),
                        (0, r.jsx)(i(), { href: "/region", children: "Regions" }),
                        (0, r.jsx)(i(), { href: "/calculator", children: "Calculator" }),
                      ],
                    }),
                    (0, r.jsxs)("div", {
                      style: { marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" },
                      children: [
                        e
                          ? (0, r.jsxs)(r.Fragment, {
                              children: [
                                (0, r.jsx)(i(), {
                                  href: "/account",
                                  className: "btn btnSecondary",
                                  style: { fontSize: 14 },
                                  children: "My Account",
                                }),
                                (0, r.jsx)("button", {
                                  onClick: () => {
                                    ((0, c.Tp)(), (0, c.Wt)(null), t(null));
                                  },
                                  className: "btnSecondary",
                                  style: {
                                    background: "none",
                                    border: "1px solid var(--border)",
                                    padding: "8px 16px",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    fontSize: 14,
                                  },
                                  children: "Sign Out",
                                }),
                              ],
                            })
                          : (0, r.jsxs)(r.Fragment, {
                              children: [
                                (0, r.jsx)(d.LoginButton, {
                                  onLoginSuccess: (e) => {
                                    (t(e), l(!1));
                                  },
                                }),
                                (0, r.jsx)("a", {
                                  className: "btn btnSecondary",
                                  href: "https://api.cloudgpus.io/admin",
                                  rel: "noreferrer",
                                  style: { fontSize: 14 },
                                  children: "Admin",
                                }),
                              ],
                            }),
                        (0, r.jsx)(i(), {
                          className: "btn",
                          href: "/cloud-gpu",
                          children: "Compare Prices",
                        }),
                      ],
                    }),
                  ],
                }),
              }),
              (0, r.jsx)(u, {
                isOpen: n,
                onClose: () => l(!1),
                onSuccess: (e) => {
                  (t(e), l(!1));
                },
              }),
            ],
          })
        );
      }
    },
    6552: (e, t, n) => {
      "use strict";
      function r(e) {
        let { moduleIds: t } = e;
        return null;
      }
      (Object.defineProperty(t, "__esModule", { value: !0 }),
        Object.defineProperty(t, "PreloadChunks", {
          enumerable: !0,
          get: function () {
            return r;
          },
        }),
        n(5155),
        n(7650),
        n(8567),
        n(7278));
    },
    7828: (e, t, n) => {
      "use strict";
      (Object.defineProperty(t, "__esModule", { value: !0 }),
        Object.defineProperty(t, "workAsyncStorageInstance", {
          enumerable: !0,
          get: function () {
            return r;
          },
        }));
      let r = (0, n(4054).createAsyncLocalStorage)();
    },
    8567: (e, t, n) => {
      "use strict";
      (Object.defineProperty(t, "__esModule", { value: !0 }),
        Object.defineProperty(t, "workAsyncStorage", {
          enumerable: !0,
          get: function () {
            return r.workAsyncStorageInstance;
          },
        }));
      let r = n(7828);
    },
  },
  (e) => {
    (e.O(0, [741, 0, 547, 441, 255, 358], () => e((e.s = 1820))), (_N_E = e.O()));
  },
]);
