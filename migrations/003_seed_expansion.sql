-- ============================================================================
-- CloudGPUs.io - Seed Expansion (Providers + GPU Models)
-- Version: 1.0.0
-- Created: 2025-12-30
-- Description: Expand seed data toward 40+ providers and additional GPU models
-- ============================================================================

BEGIN;

SET search_path TO cloudgpus, public;

-- ---------------------------------------------------------------------------
-- GPU Models (add missing models referenced by docs/SEO strategy)
-- ---------------------------------------------------------------------------

INSERT INTO cloudgpus.gpu_models (
    slug, name, short_name, manufacturer, architecture,
    vram_gb, memory_type, memory_bandwidth_gbps, tdp_watts,
    fp16_tflops, fp8_tflops, form_factor, interconnect,
    is_datacenter, is_consumer, generation_year, description, use_cases
)
VALUES
    ('l4', 'NVIDIA L4', 'L4', 'NVIDIA', 'ada_lovelace', 24, 'GDDR6', 300, 72, NULL, NULL, 'PCIe', 'PCIe Gen4', true, false, 2023, 'Efficient inference GPU optimized for low-latency serving', ARRAY['LLM Inference', 'RAG', 'Embeddings']),
    ('t4', 'NVIDIA T4', 'T4', 'NVIDIA', 'turing', 16, 'GDDR6', 320, 70, NULL, NULL, 'PCIe', 'PCIe Gen3', true, false, 2018, 'Cost-effective inference GPU widely available across clouds', ARRAY['Inference', 'Embeddings', 'Transcoding']),
    ('a40', 'NVIDIA A40', 'A40', 'NVIDIA', 'ampere', 48, 'GDDR6', 696, 300, NULL, NULL, 'PCIe', 'PCIe Gen4', true, false, 2020, 'Versatile 48GB GPU for mid-range training and graphics workloads', ARRAY['Inference', 'Fine-tuning', 'Image Generation']),
    ('v100-16gb', 'NVIDIA V100 16GB', 'V100', 'NVIDIA', 'volta', 16, 'HBM2', 900, 250, NULL, NULL, 'PCIe', 'NVLink', true, false, 2017, 'Legacy datacenter GPU still used for cost-sensitive workloads', ARRAY['Training', 'Inference', 'Development'])
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    short_name = EXCLUDED.short_name,
    architecture = EXCLUDED.architecture,
    vram_gb = EXCLUDED.vram_gb,
    memory_type = EXCLUDED.memory_type,
    memory_bandwidth_gbps = EXCLUDED.memory_bandwidth_gbps,
    tdp_watts = EXCLUDED.tdp_watts,
    updated_at = NOW();

-- ---------------------------------------------------------------------------
-- Providers (expand toward 40+)
-- ---------------------------------------------------------------------------

INSERT INTO cloudgpus.providers (
    slug, name, display_name, provider_type, reliability_tier,
    headquarters_country, website_url, pricing_url, docs_url,
    api_base_url, api_auth_type, has_public_api,
    supports_spot_instances, supports_reserved_instances,
    description, is_active
)
VALUES
    ('jarvis-labs', 'Jarvis Labs', 'Jarvis', 'specialized_neocloud', 'standard', 'USA', 'https://jarvislabs.ai', 'https://jarvislabs.ai/pricing', NULL, NULL, 'api_key', true, true, false, 'GPU cloud focused on fast provisioning for developers and researchers.', true),
    ('genesis-cloud', 'Genesis Cloud', 'Genesis', 'regional_cloud', 'standard', 'ISL', 'https://genesiscloud.com', 'https://genesiscloud.com/pricing', 'https://docs.genesiscloud.com', NULL, 'api_key', false, false, false, 'Iceland-based GPU cloud with a focus on energy-efficient datacenters and predictable pricing.', true),
    ('digitalocean', 'DigitalOcean', 'DigitalOcean', 'regional_cloud', 'standard', 'USA', 'https://www.digitalocean.com', 'https://www.digitalocean.com/pricing', 'https://docs.digitalocean.com', 'https://api.digitalocean.com/v2', 'bearer_token', true, false, true, 'General-purpose cloud with simple pricing and developer-friendly APIs (GPU availability varies by region).', true),
    ('linode', 'Linode (Akamai)', 'Linode', 'regional_cloud', 'standard', 'USA', 'https://www.linode.com', 'https://www.linode.com/products/gpu/', 'https://www.linode.com/docs', 'https://api.linode.com/v4', 'bearer_token', true, false, false, 'Developer-focused cloud with straightforward APIs and predictable billing.', true),
    ('ovhcloud', 'OVHcloud', 'OVHcloud', 'bare_metal', 'standard', 'FRA', 'https://www.ovhcloud.com', 'https://www.ovhcloud.com/en/public-cloud/prices/', 'https://help.ovhcloud.com', NULL, NULL, false, false, true, 'European cloud and bare metal provider with strong compliance and data residency options.', true),
    ('oracle-cloud', 'Oracle Cloud Infrastructure', 'OCI', 'hyperscaler', 'enterprise', 'USA', 'https://www.oracle.com/cloud', 'https://www.oracle.com/cloud/price-list/', 'https://docs.oracle.com/en-us/iaas/Content/home.htm', 'https://iaas.oraclecloud.com', 'oauth2', true, true, true, 'Enterprise cloud with competitive GPU shapes for training and inference (region-dependent).', true),
    ('ibm-cloud', 'IBM Cloud', 'IBM Cloud', 'hyperscaler', 'enterprise', 'USA', 'https://www.ibm.com/cloud', 'https://www.ibm.com/cloud/pricing', 'https://cloud.ibm.com/docs', 'https://cloud.ibm.com', 'iam_token', true, false, true, 'Enterprise cloud with regulated-industry focus and GPU-enabled compute options.', true),

    -- Asia hyperscalers / regional providers (GPU availability varies; enable as placeholders)
    ('alibaba-cloud', 'Alibaba Cloud', 'Alibaba Cloud', 'hyperscaler', 'enterprise', 'CHN', 'https://www.alibabacloud.com', 'https://www.alibabacloud.com/pricing', 'https://www.alibabacloud.com/help', NULL, 'api_key', true, false, true, 'Major Asia hyperscaler with GPU instances and broad regional coverage.', true),
    ('tencent-cloud', 'Tencent Cloud', 'Tencent Cloud', 'hyperscaler', 'enterprise', 'CHN', 'https://www.tencentcloud.com', 'https://www.tencentcloud.com/pricing', 'https://www.tencentcloud.com/document', NULL, 'api_key', true, false, true, 'Asia hyperscaler offering GPU compute across APAC regions.', true),
    ('huawei-cloud', 'Huawei Cloud', 'Huawei Cloud', 'hyperscaler', 'enterprise', 'CHN', 'https://www.huaweicloud.com', 'https://www.huaweicloud.com/intl/en-us/pricing', 'https://support.huaweicloud.com/intl/en-us', NULL, 'api_key', true, false, true, 'Global cloud provider with GPU offerings and strong enterprise footprint in APAC.', true),
    ('baidu-cloud', 'Baidu AI Cloud', 'Baidu Cloud', 'hyperscaler', 'enterprise', 'CHN', 'https://cloud.baidu.com', 'https://cloud.baidu.com/product', 'https://cloud.baidu.com/doc', NULL, 'api_key', false, false, true, 'China-based cloud provider with GPU instances and AI-focused services.', true),

    -- Bare metal / hosting providers (use as coverage expansion; pricing parsing is provider-specific)
    ('phoenixnap', 'phoenixNAP', 'phoenixNAP', 'bare_metal', 'standard', 'USA', 'https://phoenixnap.com', 'https://phoenixnap.com/pricing', 'https://developers.phoenixnap.com', NULL, 'api_key', false, false, true, 'Bare metal and dedicated hosting provider offering GPU servers (availability varies).', true),
    ('leaseweb', 'Leaseweb', 'Leaseweb', 'bare_metal', 'standard', 'NLD', 'https://www.leaseweb.com', 'https://www.leaseweb.com/pricing', 'https://developer.leaseweb.com', NULL, 'api_key', false, false, true, 'Global hosting provider with dedicated GPU server offerings.', true),
    ('servers-com', 'Servers.com', 'Servers.com', 'bare_metal', 'standard', 'USA', 'https://www.servers.com', 'https://www.servers.com/pricing', NULL, NULL, NULL, false, false, true, 'Bare metal provider with configurable GPU server options (enterprise-oriented).', true),
    ('hivelocity', 'Hivelocity', 'Hivelocity', 'bare_metal', 'standard', 'USA', 'https://www.hivelocity.net', 'https://www.hivelocity.net/pricing/', NULL, NULL, NULL, false, false, true, 'Dedicated server provider with GPU hardware offerings and managed options.', true),

    -- India / APAC regional GPU clouds
    ('e2e-networks', 'E2E Networks', 'E2E', 'regional_cloud', 'standard', 'IND', 'https://www.e2enetworks.com', 'https://www.e2enetworks.com/pricing', NULL, NULL, 'api_key', false, true, false, 'India-based cloud provider offering GPU instances for AI workloads.', true),
    ('acecloud', 'Ace Cloud', 'Ace Cloud', 'regional_cloud', 'standard', 'IND', 'https://www.acecloud.in', 'https://www.acecloud.in/pricing', NULL, NULL, 'api_key', false, false, false, 'India-based GPU cloud and managed AI infrastructure provider.', true),

    -- DePIN / decentralized compute networks (community reliability by default)
    ('akash', 'Akash Network', 'Akash', 'depin', 'community', NULL, 'https://akash.network', 'https://akash.network', 'https://docs.akash.network', NULL, NULL, true, true, false, 'Decentralized compute marketplace; pricing and reliability vary by provider.', true),
    ('aethir', 'Aethir', 'Aethir', 'depin', 'community', NULL, 'https://aethir.com', 'https://aethir.com', NULL, NULL, NULL, false, true, false, 'Decentralized GPU cloud network focused on distributed capacity.', true),
    ('clore-ai', 'Clore.ai', 'Clore.ai', 'depin', 'community', NULL, 'https://clore.ai', 'https://clore.ai', NULL, NULL, NULL, false, true, false, 'Decentralized marketplace for renting GPU compute (quality varies by node).', true),
    ('golem', 'Golem Network', 'Golem', 'depin', 'community', NULL, 'https://golem.network', 'https://golem.network', 'https://docs.golem.network', NULL, NULL, true, true, false, 'Decentralized compute network with variable performance and reliability.', true),
    ('render-network', 'Render Network', 'Render', 'depin', 'community', NULL, 'https://rendernetwork.com', 'https://rendernetwork.com', NULL, NULL, NULL, false, true, false, 'Decentralized network for GPU workloads; availability and pricing vary by supply.', true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    display_name = EXCLUDED.display_name,
    provider_type = EXCLUDED.provider_type,
    reliability_tier = EXCLUDED.reliability_tier,
    headquarters_country = EXCLUDED.headquarters_country,
    website_url = EXCLUDED.website_url,
    pricing_url = EXCLUDED.pricing_url,
    docs_url = EXCLUDED.docs_url,
    api_base_url = EXCLUDED.api_base_url,
    api_auth_type = EXCLUDED.api_auth_type,
    has_public_api = EXCLUDED.has_public_api,
    supports_spot_instances = EXCLUDED.supports_spot_instances,
    supports_reserved_instances = EXCLUDED.supports_reserved_instances,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

COMMIT;

