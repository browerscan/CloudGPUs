# CloudGPUs.io 综合优化计划

> 生成时间: 2025-12-31
> 状态: 执行中

## 执行摘要

基于6个专业Agent的深入分析，当前项目处于**Beta+阶段**（约60%生产就绪）。主要问题集中在：

- **安全**: 3个关键漏洞需立即修复
- **SEO**: 缺少sitemap/robots.txt和完整meta标签
- **UX**: 移动端适配和无障碍访问
- **代码**: DRY违规和N+1查询模式

---

## 第一阶段: 关键安全修复 (P0 - 立即执行)

### 1.1 PAYLOAD_SECRET生产安全

**文件**: `src/payload.config.ts:10-18`

```typescript
// 当前: 警告但继续运行
// 修复: 生产环境必须终止
if (process.env["NODE_ENV"] === "production" && secret === devSecret) {
  throw new Error("PAYLOAD_SECRET must be set in production. Refusing to start.");
}
```

### 1.2 Admin认证强制启用

**文件**: `src/admin/auth.ts:18-24`

```typescript
// 当前: 未配置时返回503但在开发模式绕过
// 修复: 生产环境必须启用认证
if ((process.env["NODE_ENV"] ?? "development") === "production" && !enabled) {
  throw new Error("Admin auth must be configured in production");
}
```

### 1.3 CORS严格模式

**文件**: `src/server.ts:78-90`

```typescript
// 当前: 未设置时允许所有来源
// 修复: 生产环境默认拒绝
origin: (() => {
  if (env.NODE_ENV === "production" && !env.CORS_ORIGINS) {
    return false; // Fail closed
  }
  // ... existing logic
})();
```

### 1.4 Affiliate Secret仅限Header

**文件**: `src/api/handlers/affiliate-postback.ts:41-43`

```typescript
// 移除query string中的secret
// 仅接受x-affiliate-secret header
```

---

## 第二阶段: 后端架构优化 (P0-P1)

### 2.1 代码复用 - 错误响应助手

**新建**: `src/api/error-responses.ts`

```typescript
export function badRequest(res: Response, details: unknown, message?: string) {
  return res.status(400).json({
    status: 400,
    error: "bad_request",
    message: message ?? "Invalid request",
    details,
    timestamp: new Date().toISOString(),
  });
}

export function notFound(res: Response, resource: string) {
  return res.status(404).json({
    status: 404,
    error: "not_found",
    message: `${resource} not found`,
    timestamp: new Date().toISOString(),
  });
}
```

**影响**: 减少~100行重复代码

### 2.2 Provider查找统一函数

**新建**: `src/api/repositories/shared.ts`

```typescript
export async function findProviderBySlug(pool: Pool, slug: string) {
  const res = await pool.query<{ id: string }>(
    "SELECT id FROM cloudgpus.providers WHERE slug = $1",
    [slug],
  );
  if (!res.rows.length) {
    throw new NotFoundError(`Provider not found: ${slug}`);
  }
  return res.rows[0].id;
}
```

**影响**: 消除5处重复逻辑

### 2.3 N+1查询优化

**文件**: `src/api/repositories/instances.ts`

```typescript
// 批量查询GPU ID
const gpuIds = instances.map((i) => i.gpuSlug);
const gpuMap = await pool.query("SELECT id, slug FROM cloudgpus.gpu_models WHERE slug = ANY($1)", [
  gpuIds,
]);
```

### 2.4 输入验证增强

**文件**: `src/api/handlers/alerts.ts:10-15`

```typescript
const subscribeSchema = z.object({
  email: z.string().email().max(255),
  gpuSlug: z.string().min(1).max(50),
  providerSlug: z.string().min(1).max(50).optional(),
  targetPricePerGpuHour: z.coerce.number().positive().max(1000),
});
```

### 2.5 缓存失效策略

**文件**: `src/workers/pricing/aggregate.ts`

```typescript
// 价格更新后清除相关缓存
await redis.del(`providers:list`);
await redis.del(`instances:list`);
await redis.del(`gpus:list`);
// 清除特定GPU缓存
const pattern = `gpus:get:*`;
for (const key of await redis.keys(pattern)) {
  await redis.del(key);
}
```

---

## 第三阶段: 前端优化 (P0-P1)

### 3.1 CSS变量与设计令牌

**文件**: `frontend/app/globals.css`

```css
:root {
  /* Colors */
  --color-primary: #0b1220;
  --color-background: #f6f8fb;
  --color-border: rgba(15, 23, 42, 0.08);
  --color-border-strong: rgba(15, 23, 42, 0.12);
  --color-text-muted: rgba(15, 23, 42, 0.65);
  --color-focus-ring: #2563eb;

  /* Spacing */
  --spacing-xs: 8px;
  --spacing-sm: 10px;
  --spacing-md: 16px;
  --spacing-lg: 24px;

  /* Border radius */
  --radius-sm: 10px;
  --radius-md: 14px;

  /* Shadows */
  --shadow-card: 0 10px 30px rgba(2, 6, 23, 0.06);
}

/* Focus states for accessibility */
:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

/* Form elements */
.input,
.select,
.textarea {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-strong);
  font: inherit;
}
```

### 3.2 移动端响应式Header

**文件**: `frontend/app/layout.tsx`

```tsx
<header className="site-header" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0 }}>
  <div className="container header-content">
    <a href="/" className="logo">
      CloudGPUs.io
    </a>
    <button className="mobile-menu-toggle" aria-label="Toggle menu" aria-expanded={mobileMenuOpen}>
      ☰
    </button>
    <nav className={mobileMenuOpen ? "open" : ""} aria-label="Main navigation">
      {/* navigation links */}
    </nav>
  </div>
</header>
```

```css
@media (max-width: 768px) {
  .mobile-menu-toggle {
    display: block;
  }
  nav {
    display: none;
    width: 100%;
    flex-direction: column;
  }
  nav.open {
    display: flex;
  }
}
```

### 3.3 PriceTable高亮最便宜行

**文件**: `frontend/components/PriceTable.tsx`

```typescript
const cheapestPrice = Math.min(
  ...rows.filter(r => r.onDemand).map(r => r.onDemand!)
);

{rows.map(row => (
  <tr className={row.onDemand === cheapestPrice ? 'cheapest-row' : ''}>
    {/* ... */}
  </tr>
))}
```

```css
.cheapest-row {
  background: rgba(34, 197, 94, 0.1);
  font-weight: 600;
}
.cheapest-row::before {
  content: "🏆 Best Price";
  position: absolute;
  left: -80px;
  font-size: 10px;
}
```

### 3.4 表格可访问性

**文件**: `frontend/components/PriceTable.tsx`

```tsx
<table>
  <caption style={{ display: "none" }}>
    GPU pricing comparison table showing provider, on-demand and spot prices
  </caption>
  <thead>
    <tr>
      <th scope="col">Provider</th>
      <th scope="col">On-demand</th>
      {/* ... */}
    </tr>
  </thead>
</table>
```

### 3.5 表单状态ARIA

**文件**: `frontend/components/PriceAlertForm.tsx`

```tsx
{
  status.kind === "success" && (
    <span role="status" aria-live="polite" className="success-message">
      {status.message}
    </span>
  );
}
{
  status.kind === "error" && (
    <span role="alert" aria-live="assertive" className="error-message">
      Error: {status.message}
    </span>
  );
}
```

---

## 第四阶段: SEO优化 (P0-P1)

### 4.1 根Layout增强元数据

**文件**: `frontend/app/layout.tsx`

```typescript
export const metadata: Metadata = {
  metadataBase: new URL("https://cloudgpus.io"),
  title: {
    default: "CloudGPUs.io — Compare GPU Cloud Prices",
    template: "%s | CloudGPUs.io",
  },
  description:
    "Compare on-demand and spot GPU pricing across 40+ cloud providers. Find the cheapest H100, A100, H200, RTX 4090 prices instantly.",
  keywords: [
    "GPU cloud",
    "GPU pricing",
    "cloud GPU comparison",
    "H100 pricing",
    "A100 pricing",
    "spot GPU",
    "GPU rental",
  ],
  authors: [{ name: "CloudGPUs.io" }],
  creator: "CloudGPUs.io",
  publisher: "CloudGPUs.io",

  openGraph: {
    type: "website",
    siteName: "CloudGPUs.io",
    title: "CloudGPUs.io — Compare GPU Cloud Prices",
    description: "Compare on-demand and spot GPU pricing across cloud providers.",
    url: "https://cloudgpus.io",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "CloudGPUs.io",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "CloudGPUs.io — Compare GPU Cloud Prices",
    description: "Compare on-demand and spot GPU pricing across cloud providers.",
    images: ["/og.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  alternates: {
    canonical: "https://cloudgpus.io",
  },
};
```

### 4.2 动态OG图片路由

**新建**: `frontend/app/opengraph-image.tsx`

```typescript
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };

export default function Image() {
  return new ImageResponse(
    (
      <div tw="flex h-full w-full bg-gradient-to-br from-slate-900 to-slate-800 p-16">
        <div tw="flex flex-col justify-between">
          <div tw="text-6xl font-black text-white">CloudGPUs.io</div>
          <div tw="text-4xl font-bold text-emerald-400">Compare GPU Cloud Pricing</div>
          <div tw="text-2xl text-slate-300">H100 · A100 · H200 · RTX 4090 · RTX 5090</div>
        </div>
      </div>
    ),
    size
  );
}
```

### 4.3 Organization Schema

**新建**: `frontend/components/OrganizationSchema.tsx`

```typescript
export function OrganizationSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "CloudGPUs.io",
    "url": "https://cloudgpus.io",
    "logo": "https://cloudgpus.io/logo.png",
    "description": "GPU cloud price comparison platform",
    "sameAs": []
  };
  return <JsonLd schema={schema} />;
}
```

### 4.4 GPU页面Product Schema

**文件**: `frontend/app/cloud-gpu/[slug]/page.tsx`

```typescript
const productSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: gpu.name,
  description: `Compare ${gpu.name} cloud pricing`,
  offers: {
    "@type": "AggregateOffer",
    lowPrice: cheapestPrice,
    highPrice: highestPrice,
    priceCurrency: "USD",
    offerCount: instances.length,
    availability: "https://schema.org/InStock",
  },
};
```

### 4.5 Sitemap验证

**验证**: `frontend/app/sitemap.ts` 存在并包含所有页面类型

- 主页
- GPU页面 (priority 0.9)
- Provider页面 (priority 0.8)
- Compare页面 (priority 0.7)
- Use case页面 (priority 0.6)

---

## 第五阶段: 内容优化 (P1-P2)

### 5.1 GPU页面内容扩充

**当前**: 2-3句简介
**目标**: 150-200词结构化内容

```tsx
<section className="card gpu-description">
  <h2>About {gpu.name}</h2>
  <p>
    The {gpu.name} is a {gpu.architecture}-based GPU with {gpu.vram_gb}GB of VRAM.
    It's ideal for {useCases.join(', ')}.
  </p>

  <h3>Key Specifications</h3>
  <ul>
    <li>VRAM: {gpu.vram_gb}GB</li>
    <li>Architecture: {gpu.architecture}</li>
    <li>{providersCount} providers available</li>
    <li>Prices from ${minPrice}/hr</li>
  </ul>

  <h3>Best For</h3>
  <p>{recommendedUseCases}</p>
</section>

<section className="card gpu-alternatives">
  <h2>Alternatives to {gpu.name}</h2>
  <div className="grid grid3">
    {alternatives.map(alt => (
      <Link href={`/cloud-gpu/${alt.slug}`}>
        {alt.name} - {alt.vram_gb}GB VRAM
      </Link>
    ))}
  </div>
</section>
```

### 5.2 内部链接增强

```tsx
<section className="card related-pages">
  <h2>Related Comparisons</h2>
  <ul>
    <li>
      <Link href={`/compare/${gpu.slug}-vs-${alt.slug}`}>
        {gpu.name} vs {alt.name}
      </Link>
    </li>
  </ul>
</section>
```

### 5.3 新增pSEO页面

#### 预算页面

**新建**: `frontend/app/budget/[amount]/page.tsx`

- `/budget/100` - "GPUs under $100/month"
- `/budget/500` - "GPUs under $500/month"
- `/budget/1000` - "GPUs under $1000/month"

#### VRAM页面

**新建**: `frontend/app/vram/[amount]/page.tsx`

- `/vram/24gb` - "24GB VRAM GPUs"
- `/vram/80gb` - "80GB VRAM GPUs"

#### 框架页面

**新建**: `frontend/app/framework/[slug]/page.tsx`

- `/framework/pytorch` - "Best GPU for PyTorch"
- `/framework/tensorflow` - "Best GPU for TensorFlow"

---

## 第六阶段: 测试与验证 (P1)

### 6.1 安全测试

```typescript
// tests/security.test.ts
describe("Security", () => {
  it("should reject SQL injection attempts", () => {});
  it("should rate limit brute force attempts", () => {});
  it("should validate CORS origins", () => {});
  it("should fail without PAYLOAD_SECRET in production", () => {});
});
```

### 6.2 集成测试

```typescript
// tests/integration/flows.test.ts
describe("User Flows", () => {
  it("should complete price comparison flow", () => {});
  it("should create and confirm alert subscription", () => {});
  it("should submit review for moderation", () => {});
});
```

### 6.3 可访问性测试

- Lighthouse Accessibility audit (目标: 100分)
- WAVE工具验证
- 键盘导航测试

---

## 执行优先级时间表

| 周次 | 任务              | 负责Agent               |
| ---- | ----------------- | ----------------------- |
| W1   | 安全修复(P0)      | Security + Architecture |
| W1   | 后端重构(P0)      | Code Expert             |
| W2   | 前端UX优化(P0-P1) | UI Expert               |
| W2   | SEO元数据完善(P0) | PSEO                    |
| W3   | 内容扩充(P1)      | PM + Content            |
| W3   | 测试覆盖(P1)      | Test Expert             |
| W4   | 验证与部署准备    | All                     |

---

## 成功指标

| 指标                     | 当前       | 目标 |
| ------------------------ | ---------- | ---- |
| Lighthouse Performance   | ?          | >90  |
| Lighthouse Accessibility | ?          | 100  |
| Lighthouse SEO           | ?          | >95  |
| 安全漏洞                 | 3 critical | 0    |
| 测试覆盖率               | ~60%       | >80% |
| 页面加载时间             | ?          | <2s  |

---

## 联系与进度追踪

- 项目根: `/Volumes/SSD/skills/server-ops/vps/107.174.42.198/heavy-tasks/vibing-code/CloudGPUs.io`
- 文档目录: `docs/`
- 执行状态: 见各Agent任务输出
