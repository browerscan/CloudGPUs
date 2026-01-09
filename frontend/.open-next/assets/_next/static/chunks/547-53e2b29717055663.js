"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [547],
  {
    3547: (e, t, r) => {
      (r.r(t), r.d(t, { AuthModal: () => i, LoginButton: () => s, useAuth: () => l }));
      var n = r(5155),
        o = r(2115),
        a = r(7621);
      function i(e) {
        let { isOpen: t, onClose: r, onSuccess: i, defaultMode: s = "login" } = e,
          [l, c] = (0, o.useState)(s),
          [d, u] = (0, o.useState)(""),
          [g, p] = (0, o.useState)(""),
          [m, h] = (0, o.useState)(""),
          [f, b] = (0, o.useState)(""),
          [y, S] = (0, o.useState)(!1),
          [v, x] = (0, o.useState)("");
        if (
          ((0, o.useEffect)(() => {
            t && (c(s), b(""), x(""));
          }, [t, s]),
          !t)
        )
          return null;
        let k = async (e) => {
          (e.preventDefault(), b(""), x(""), S(!0));
          try {
            if ("login" === l) {
              let e = await (0, a.iD)(d, g);
              ((0, a.O5)(e.data.accessToken),
                (0, a.Wt)(e.data.user),
                null == i || i(e.data.user),
                r());
            } else if ("register" === l) {
              if (g.length < 8) {
                (b("Password must be at least 8 characters"), S(!1));
                return;
              }
              let e = await (0, a.kz)(d, g, m || void 0);
              ((0, a.O5)(e.data.accessToken),
                (0, a.Wt)(e.data.user),
                x("Account created! Check your email to verify your address."),
                null == i || i(e.data.user),
                setTimeout(() => r(), 1500));
            } else
              "forgot" === l &&
                (x("If an account exists with this email, a password reset link will be sent."),
                p(""));
          } catch (e) {
            b(e instanceof Error ? e.message : "An error occurred");
          } finally {
            S(!1);
          }
        };
        return (0, n.jsx)("div", {
          className: "auth-modal-overlay",
          style: {
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1e3,
          },
          onClick: r,
          children: (0, n.jsxs)("div", {
            className: "auth-modal card",
            style: {
              background: "var(--bg)",
              padding: 32,
              width: "100%",
              maxWidth: 400,
              borderRadius: 12,
            },
            onClick: (e) => e.stopPropagation(),
            children: [
              (0, n.jsxs)("div", {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 24,
                },
                children: [
                  (0, n.jsx)("h2", {
                    style: { margin: 0, fontSize: 24 },
                    children:
                      "login" === l
                        ? "Sign In"
                        : "register" === l
                          ? "Create Account"
                          : "Reset Password",
                  }),
                  (0, n.jsx)("button", {
                    onClick: r,
                    style: {
                      background: "none",
                      border: "none",
                      fontSize: 24,
                      cursor: "pointer",
                      padding: 4,
                    },
                    "aria-label": "Close",
                    children: "\xd7",
                  }),
                ],
              }),
              f &&
                (0, n.jsx)("div", {
                  style: {
                    padding: 12,
                    background: "var(--error-bg, #fee)",
                    color: "var(--error, #c33)",
                    borderRadius: 6,
                    marginBottom: 16,
                    fontSize: 14,
                  },
                  children: f,
                }),
              v &&
                (0, n.jsx)("div", {
                  style: {
                    padding: 12,
                    background: "var(--success-bg, #efe)",
                    color: "var(--success, #3c3)",
                    borderRadius: 6,
                    marginBottom: 16,
                    fontSize: 14,
                  },
                  children: v,
                }),
              (0, n.jsxs)("form", {
                onSubmit: k,
                style: { display: "flex", flexDirection: "column", gap: 16 },
                children: [
                  "register" === l &&
                    (0, n.jsxs)("div", {
                      children: [
                        (0, n.jsx)("label", {
                          htmlFor: "name",
                          style: { display: "block", marginBottom: 4, fontSize: 14 },
                          children: "Name (optional)",
                        }),
                        (0, n.jsx)("input", {
                          id: "name",
                          type: "text",
                          value: m,
                          onChange: (e) => h(e.target.value),
                          placeholder: "Your name",
                          style: {
                            width: "100%",
                            padding: 10,
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            fontSize: 14,
                          },
                        }),
                      ],
                    }),
                  (0, n.jsxs)("div", {
                    children: [
                      (0, n.jsx)("label", {
                        htmlFor: "email",
                        style: { display: "block", marginBottom: 4, fontSize: 14 },
                        children: "Email",
                      }),
                      (0, n.jsx)("input", {
                        id: "email",
                        type: "email",
                        value: d,
                        onChange: (e) => u(e.target.value),
                        placeholder: "you@example.com",
                        required: !0,
                        autoComplete: "email",
                        style: {
                          width: "100%",
                          padding: 10,
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          fontSize: 14,
                        },
                      }),
                    ],
                  }),
                  "forgot" !== l &&
                    (0, n.jsxs)("div", {
                      children: [
                        (0, n.jsx)("label", {
                          htmlFor: "password",
                          style: { display: "block", marginBottom: 4, fontSize: 14 },
                          children: "Password",
                        }),
                        (0, n.jsx)("input", {
                          id: "password",
                          type: "password",
                          value: g,
                          onChange: (e) => p(e.target.value),
                          placeholder: "register" === l ? "At least 8 characters" : "Your password",
                          required: !0,
                          autoComplete: "login" === l ? "current-password" : "new-password",
                          minLength: 8,
                          style: {
                            width: "100%",
                            padding: 10,
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            fontSize: 14,
                          },
                        }),
                      ],
                    }),
                  "login" === l &&
                    (0, n.jsxs)("div", {
                      style: { display: "flex", alignItems: "center", gap: 8, fontSize: 14 },
                      children: [
                        (0, n.jsx)("input", {
                          type: "checkbox",
                          id: "remember",
                          style: { width: 16, height: 16 },
                        }),
                        (0, n.jsx)("label", {
                          htmlFor: "remember",
                          style: { cursor: "pointer" },
                          children: "Remember me for 30 days",
                        }),
                      ],
                    }),
                  (0, n.jsx)("button", {
                    type: "submit",
                    disabled: y,
                    className: "btn",
                    style: {
                      width: "100%",
                      padding: 12,
                      fontSize: 16,
                      fontWeight: 600,
                      opacity: y ? 0.6 : 1,
                      cursor: y ? "not-allowed" : "pointer",
                    },
                    children: y
                      ? "Loading..."
                      : "login" === l
                        ? "Sign In"
                        : "register" === l
                          ? "Create Account"
                          : "Send Reset Link",
                  }),
                ],
              }),
              (0, n.jsx)("div", {
                style: {
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: "1px solid var(--border)",
                  fontSize: 14,
                },
                children:
                  "login" === l
                    ? (0, n.jsxs)(n.Fragment, {
                        children: [
                          (0, n.jsx)("div", {
                            style: { marginBottom: 8 },
                            children: (0, n.jsx)("button", {
                              type: "button",
                              onClick: () => c("register"),
                              style: {
                                background: "none",
                                border: "none",
                                color: "var(--link, #0066cc)",
                                cursor: "pointer",
                                fontSize: 14,
                              },
                              children: "Don't have an account? Sign up",
                            }),
                          }),
                          (0, n.jsx)("button", {
                            type: "button",
                            onClick: () => c("forgot"),
                            style: {
                              background: "none",
                              border: "none",
                              color: "var(--muted, #666)",
                              cursor: "pointer",
                              fontSize: 14,
                            },
                            children: "Forgot password?",
                          }),
                        ],
                      })
                    : "register" === l
                      ? (0, n.jsx)("button", {
                          type: "button",
                          onClick: () => c("login"),
                          style: {
                            background: "none",
                            border: "none",
                            color: "var(--link, #0066cc)",
                            cursor: "pointer",
                            fontSize: 14,
                          },
                          children: "Already have an account? Sign in",
                        })
                      : (0, n.jsx)("button", {
                          type: "button",
                          onClick: () => c("login"),
                          style: {
                            background: "none",
                            border: "none",
                            color: "var(--link, #0066cc)",
                            cursor: "pointer",
                            fontSize: 14,
                          },
                          children: "Back to sign in",
                        }),
              }),
            ],
          }),
        });
      }
      function s(e) {
        let { onLoginSuccess: t, children: r } = e,
          [a, s] = (0, o.useState)(!1);
        return (0, n.jsxs)(n.Fragment, {
          children: [
            (0, n.jsx)("button", {
              onClick: () => s(!0),
              className: "btn btnSecondary",
              style: { cursor: "pointer" },
              children: r || "Sign In",
            }),
            (0, n.jsx)(i, { isOpen: a, onClose: () => s(!1), onSuccess: t }),
          ],
        });
      }
      function l() {
        let [e, t] = (0, o.useState)(null),
          [r, n] = (0, o.useState)(!0);
        return (
          (0, o.useEffect)(() => {
            (t((0, a.Yk)()), n(!1));
          }, []),
          {
            user: e,
            loading: r,
            login: (e, r) => {
              ((0, a.O5)(r), (0, a.Wt)(e), t(e));
            },
            logout: () => {
              ((0, a.Tp)(), (0, a.Wt)(null), t(null));
            },
            isAuthenticated: !!e,
          }
        );
      }
    },
    3850: (e, t, r) => {
      r.d(t, { _: () => s });
      var n,
        o,
        a,
        i = r(5704);
      let s = {
        apiBaseUrl: null != (n = i.env.NEXT_PUBLIC_API_BASE_URL) ? n : "https://api.cloudgpus.io",
        apiKey: null != (a = null != (o = i.env.BUILD_API_KEY) ? o : i.env.API_KEY) ? a : null,
      };
    },
    7621: (e, t, r) => {
      r.d(t, {
        DR: () => l,
        O5: () => o,
        Tp: () => a,
        Wt: () => s,
        Yk: () => i,
        iD: () => u,
        jp: () => g,
        kz: () => d,
        qu: () => h,
        rc: () => p,
        tD: () => m,
      });
      var n = r(3850);
      function o(e) {
        localStorage.setItem("auth_token", e);
      }
      function a() {
        localStorage.removeItem("auth_token");
      }
      function i() {
        let e = localStorage.getItem("auth_user");
        return e ? JSON.parse(e) : null;
      }
      function s(e) {
        e
          ? localStorage.setItem("auth_user", JSON.stringify(e))
          : localStorage.removeItem("auth_user");
      }
      function l(e) {
        let t = new URL("/api/affiliate/click", n._.apiBaseUrl);
        return (
          t.searchParams.set("provider", e.providerSlug),
          e.gpuSlug && t.searchParams.set("gpu", e.gpuSlug),
          t.searchParams.set("utm_source", "cloudgpus.io"),
          t.searchParams.set("utm_medium", "referral"),
          t.toString()
        );
      }
      async function c(e, t) {
        let r = new URL(e, n._.apiBaseUrl),
          o = localStorage.getItem("auth_token"),
          a = { accept: "application/json", "content-type": "application/json" };
        (o && (a.authorization = "Bearer ".concat(o)),
          (null == t ? void 0 : t.headers) && Object.assign(a, t.headers));
        let i = await fetch(r.toString(), { ...t, headers: a });
        if (!i.ok) {
          let e = await i.json().catch(() => ({ error: "Unknown error" }));
          throw Error(e.error || e.message || "API ".concat(i.status));
        }
        return await i.json();
      }
      async function d(e, t, r) {
        return c("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ email: e, password: t, name: r }),
        });
      }
      async function u(e, t) {
        return c("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: e, password: t }),
        });
      }
      async function g() {
        return c("/api/me", { method: "GET" });
      }
      async function p() {
        return c("/api/me/comparisons", { method: "GET" });
      }
      async function m(e) {
        return c("/api/me/comparisons/".concat(e), { method: "DELETE" });
      }
      async function h() {
        return c("/api/me/alerts", { method: "GET" });
      }
    },
  },
]);
