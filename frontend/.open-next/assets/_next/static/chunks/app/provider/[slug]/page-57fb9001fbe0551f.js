(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [914],
  {
    3827: (e, a, s) => {
      (Promise.resolve().then(s.bind(s, 7e3)), Promise.resolve().then(s.t.bind(s, 2619, 23)));
    },
    3850: (e, a, s) => {
      "use strict";
      s.d(a, { _: () => r });
      var i,
        t,
        l,
        n = s(5704);
      let r = {
        apiBaseUrl: null != (i = n.env.NEXT_PUBLIC_API_BASE_URL) ? i : "https://api.cloudgpus.io",
        apiKey: null != (l = null != (t = n.env.BUILD_API_KEY) ? t : n.env.API_KEY) ? l : null,
      };
    },
    7e3: (e, a, s) => {
      "use strict";
      s.d(a, { ReviewForm: () => n });
      var i = s(5155),
        t = s(2115),
        l = s(3850);
      function n(e) {
        let { providerSlug: a } = e,
          [s, n] = (0, t.useState)(5),
          [r, d] = (0, t.useState)(""),
          [o, c] = (0, t.useState)(""),
          [m, p] = (0, t.useState)(""),
          [u, h] = (0, t.useState)(""),
          [g, v] = (0, t.useState)({ kind: "idle" }),
          y = "submitting" === g.kind,
          b = (0, t.useMemo)(
            () =>
              !!Number.isFinite(s) &&
              !(s < 1) &&
              !(s > 5) &&
              !(o.trim().length < 20) &&
              (!u || !!u.includes("@")),
            [s, o, u],
          ),
          x = o.trim().length > 0 && o.trim().length < 20,
          j = u.trim() && !u.includes("@");
        async function N(e) {
          if ((e.preventDefault(), b)) {
            v({ kind: "submitting" });
            try {
              let e = await fetch(
                ""
                  .concat(l._.apiBaseUrl, "/api/providers/")
                  .concat(encodeURIComponent(a), "/reviews"),
                {
                  method: "POST",
                  headers: { "content-type": "application/json", accept: "application/json" },
                  body: JSON.stringify({
                    rating: s,
                    title: r.trim() ? r.trim() : void 0,
                    body: o.trim(),
                    authorName: m.trim() ? m.trim() : void 0,
                    authorEmail: u.trim() ? u.trim() : void 0,
                  }),
                },
              );
              if (!e.ok) throw Error("HTTP ".concat(e.status));
              (d(""),
                c(""),
                p(""),
                h(""),
                n(5),
                v({
                  kind: "success",
                  message:
                    "Thanks — your review was submitted for moderation and should appear once approved.",
                }));
            } catch (e) {
              v({
                kind: "error",
                message: e instanceof Error ? e.message : "Failed to submit review",
              });
            }
          }
        }
        return (0, i.jsxs)("form", {
          onSubmit: N,
          className: "card",
          style: { padding: 16 },
          children: [
            (0, i.jsx)("div", { style: { fontWeight: 800 }, children: "Leave a review" }),
            (0, i.jsx)("div", {
              className: "muted",
              style: { marginTop: 6, lineHeight: 1.6, fontSize: 13 },
              children:
                "Reviews are moderated to prevent spam. Please focus on reliability, provisioning UX, pricing transparency, and support quality.",
            }),
            (0, i.jsxs)("div", {
              style: { display: "grid", gap: 10, marginTop: 12 },
              children: [
                (0, i.jsxs)("label", {
                  style: { display: "grid", gap: 6 },
                  children: [
                    (0, i.jsx)("span", {
                      className: "muted",
                      style: { fontSize: 13 },
                      children: "Rating",
                    }),
                    (0, i.jsx)("select", {
                      value: s,
                      onChange: (e) => n(Number(e.target.value)),
                      disabled: y,
                      className: "select",
                      children: [5, 4, 3, 2, 1].map((e) =>
                        (0, i.jsxs)("option", { value: e, children: [e, " / 5"] }, e),
                      ),
                    }),
                  ],
                }),
                (0, i.jsxs)("label", {
                  style: { display: "grid", gap: 6 },
                  children: [
                    (0, i.jsx)("span", {
                      className: "muted",
                      style: { fontSize: 13 },
                      children: "Title (optional)",
                    }),
                    (0, i.jsx)("input", {
                      value: r,
                      onChange: (e) => d(e.target.value),
                      disabled: y,
                      maxLength: 120,
                      placeholder: "Short summary",
                      className: "input",
                    }),
                  ],
                }),
                (0, i.jsxs)("label", {
                  style: { display: "grid", gap: 6 },
                  children: [
                    (0, i.jsx)("span", {
                      className: "muted",
                      style: { fontSize: 13 },
                      children: "Review",
                    }),
                    (0, i.jsx)("textarea", {
                      value: o,
                      onChange: (e) => c(e.target.value),
                      disabled: y,
                      minLength: 20,
                      maxLength: 4e3,
                      rows: 5,
                      placeholder: "What worked well? What didn't? Any hidden costs or gotchas?",
                      "aria-invalid": !!x || void 0,
                      "aria-describedby": x ? "body-error" : void 0,
                      className: "textarea",
                    }),
                    (0, i.jsxs)("span", {
                      className: "muted",
                      style: { fontSize: 12 },
                      children: [o.trim().length, "/4000 characters"],
                    }),
                  ],
                }),
                (0, i.jsxs)("div", {
                  style: { display: "grid", gap: 10 },
                  className: "grid grid2",
                  children: [
                    (0, i.jsxs)("label", {
                      style: { display: "grid", gap: 6 },
                      children: [
                        (0, i.jsx)("span", {
                          className: "muted",
                          style: { fontSize: 13 },
                          children: "Name (optional)",
                        }),
                        (0, i.jsx)("input", {
                          value: m,
                          onChange: (e) => p(e.target.value),
                          disabled: y,
                          maxLength: 120,
                          placeholder: "Dev Dave",
                          autoComplete: "name",
                          className: "input",
                        }),
                      ],
                    }),
                    (0, i.jsxs)("label", {
                      style: { display: "grid", gap: 6 },
                      children: [
                        (0, i.jsx)("span", {
                          className: "muted",
                          style: { fontSize: 13 },
                          children: "Email (optional)",
                        }),
                        (0, i.jsx)("input", {
                          value: u,
                          onChange: (e) => h(e.target.value),
                          disabled: y,
                          placeholder: "you@example.com",
                          type: "email",
                          autoComplete: "email",
                          "aria-invalid": !!j || void 0,
                          "aria-describedby": j ? "email-error" : void 0,
                          className: "input",
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            (0, i.jsxs)("div", {
              style: {
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
                marginTop: 12,
              },
              children: [
                (0, i.jsx)("button", {
                  className: "btn",
                  type: "submit",
                  disabled: !b || y,
                  children: "submitting" === g.kind ? "Submitting…" : "Submit review",
                }),
                "success" === g.kind
                  ? (0, i.jsx)("span", {
                      role: "status",
                      className: "muted",
                      style: { fontSize: 13 },
                      children: g.message,
                    })
                  : null,
                "error" === g.kind
                  ? (0, i.jsxs)("span", {
                      role: "alert",
                      className: "muted",
                      style: { fontSize: 13 },
                      children: ["Error: ", g.message],
                    })
                  : null,
              ],
            }),
          ],
        });
      }
    },
  },
  (e) => {
    (e.O(0, [0, 441, 255, 358], () => e((e.s = 3827))), (_N_E = e.O()));
  },
]);
