export type UseCasePage = {
  slug: string;
  name: string;
  summary: string;
  minVramGb: number;
  recommendations: {
    bestOverall: string;
    bestBudget: string;
    bestValue: string;
  };
  related: string[];
  // Extended SEO content fields
  extendedContent?: {
    introduction: string;
    quickAnswerReasoning: {
      overall: string;
      budget: string;
      value: string;
    };
    vramSection: string;
    gpuTable: {
      gpu: string;
      vram: string;
      bestFor: string;
      priceRange: string;
    }[];
    modelSizes: {
      size: string;
      requirements: string;
      gpus: string;
    }[];
    costGuide: string;
    faqs: {
      q: string;
      a: string;
    }[];
  };
};

export const USE_CASE_PAGES: UseCasePage[] = [
  {
    slug: "llm-training",
    name: "LLM training",
    summary: "Train large language models efficiently with high-VRAM GPUs and fast interconnects.",
    minVramGb: 80,
    recommendations: { bestOverall: "h100-sxm", bestBudget: "rtx-4090", bestValue: "a100-80gb" },
    related: ["multi-gpu-training", "distributed-training", "fine-tuning", "llm-inference"],
    extendedContent: {
      introduction: `<p>Choosing the best GPU for LLM training is one of the most critical decisions you'll make when building or fine-tuning large language models. The right hardware can mean the difference between a training run that completes in days versus weeks, or between staying within budget and burning through your entire compute allocation before convergence.</p>

<p>LLM training is fundamentally a memory-bound problem. Unlike traditional deep learning workloads where compute throughput dominates, language model training requires storing massive parameter sets, optimizer states, gradients, and activations—all simultaneously. A single 7 billion parameter model in FP16 precision requires approximately 14GB just for the weights, but when you account for optimizer states (AdamW requires two 32-bit momentum states per parameter) and activation memory during forward/backward passes, actual memory needs can easily exceed 40-60GB per GPU.</p>

<p>The best GPU for LLM training balances three competing factors: VRAM capacity to fit your target model size, memory bandwidth to minimize data movement bottlenecks, and interconnect bandwidth for efficient multi-GPU scaling. Professional GPUs like the H100 SXM and A100 80GB dominate production training due to their NVLink interconnects and HBM3 memory, while consumer GPUs like the RTX 4090 offer compelling value for experimentation and smaller-scale fine-tuning when multi-GPU scaling isn't required.</p>`,
      quickAnswerReasoning: {
        overall:
          "The H100 SXM5 delivers unmatched training performance with 3.35 TB/s of HBM3 memory bandwidth and 900 GB/s NVLink interconnects. Its Transformer Engine accelerates mixed FP8/FP16 training, while 80GB of VRAM fits most 7B-70B model configurations. For organizations training LLaMA 3, Mistral, or custom models at scale, the H100's time-to-trainment advantage justifies its premium pricing.",
        budget:
          "NVIDIA's RTX 4090 offers 24GB of VRAM and exceptional memory bandwidth for under $1,600. While it lacks NVLink (limiting multi-GPU efficiency) and has lower reliability than enterprise GPUs, it's perfect for fine-tuning 7B models, LoRA training, and research experimentation. Many developers build multi-node 4090 clusters as a cost-effective alternative to enterprise infrastructure.",
        value:
          "The A100 80GB PCIe remains the workhorse of LLM training. With 2 TB/s HBM2e memory bandwidth, 80GB VRAM, and PCIe 4.0 connectivity, it handles most training workloads at a fraction of H100 pricing. Its mature ecosystem, broad cloud availability, and proven reliability make it the default choice for teams balancing performance with cost.",
      },
      vramSection: `<p>VRAM is the single most important specification for LLM training. Unlike inference, where weights can be quantized and KV caches optimized, training requires full precision storage for model weights, gradients, and optimizer states.</p>

<p>For a standard training run with AdamW optimization in mixed precision (FP16), memory requirements follow this approximate formula:</p>

<p><strong>Per-GPU VRAM = (Model weights × 2) + (Optimizer states × 4) + (Gradients × 2) + Activations</strong></p>

<p>The activations component varies with sequence length, batch size, and model architecture but can easily exceed 50-70% of total memory for large batch training. This is why theoretical VRAM requirements are often misleading in practice.</p>

<p><strong>Minimum VRAM by model size (effective, accounting for training overhead):</strong></p>
<ul>
<li><strong>1B-3B models:</strong> 16-24GB (1x RTX 4090, L40s)</li>
<li><strong>7B models:</strong> 40-80GB (1x A100 80GB, or 2-4x RTX 4090 with tensor parallelism)</li>
<li><strong>13B models:</strong> 80-160GB (2x A100 80GB, or 4-8x RTX 4090)</li>
<li><strong>34B models:</strong> 160-320GB (4x A100 80GB, 2x H100 80GB)</li>
<li><strong>70B models:</strong> 320-640GB (8x A100 80GB, or 4x H100 80GB)</li>
<li><strong>400B+ models:</strong> 1.5TB+ (multi-node H100/H200 clusters)</li>
</ul>

<p>When using techniques like ZeRO optimization, DeepSpeed, or FSDP, effective memory can be distributed across GPUs, but interconnect bandwidth becomes the limiting factor. This is why H100 SXM with NVLink significantly outperforms PCIe alternatives in multi-GPU scenarios.</p>`,
      gpuTable: [
        {
          gpu: "H100 SXM5 (80GB)",
          vram: "80GB HBM3",
          bestFor: "Production LLM training, 7B-70B models",
          priceRange: "$4-8/hr",
        },
        {
          gpu: "H200 SXM (141GB)",
          vram: "141GB HBM3e",
          bestFor: "Large-scale training, 70B+ models",
          priceRange: "$5-10/hr",
        },
        {
          gpu: "A100 80GB PCIe",
          vram: "80GB HBM2e",
          bestFor: "Balanced training, broad availability",
          priceRange: "$2-4/hr",
        },
        {
          gpu: "A100 40GB PCIe",
          vram: "40GB HBM2e",
          bestFor: "Budget training, smaller models",
          priceRange: "$1-2/hr",
        },
        {
          gpu: "RTX 4090",
          vram: "24GB GDDR6X",
          bestFor: "Fine-tuning, 7B models, research",
          priceRange: "$0.40-0.80/hr",
        },
        {
          gpu: "L40S",
          vram: "48GB GDDR6",
          bestFor: "Mid-range training, 13B models",
          priceRange: "$0.80-1.50/hr",
        },
      ],
      modelSizes: [
        {
          size: "7B Models (LLaMA 7B, Mistral 7B)",
          requirements: "Minimum 40GB VRAM for full fine-tuning, 24GB for LoRA/QLoRA",
          gpus: "1x H100 SXM5 | 1x A100 80GB | 4x RTX 4090 (with tensor parallelism)",
        },
        {
          size: "13B Models (LLaMA 13B, Yi 13B)",
          requirements: "Minimum 80GB VRAM for full fine-tuning, 48GB for LoRA",
          gpus: "2x A100 80GB | 1x H200 SXM | 6-8x RTX 4090",
        },
        {
          size: "34B Models (LLaMA 34B, CodeLlama 34B)",
          requirements: "160GB+ VRAM required for full fine-tuning",
          gpus: "4x A100 80GB | 2x H100 SXM5 | Multi-node clusters",
        },
        {
          size: "70B Models (LLaMA 70B, Falcon 70B)",
          requirements: "320-640GB VRAM for efficient training",
          gpus: "8x A100 80GB | 4x H100 SXM5 | 2x H200 SXM",
        },
        {
          size: "400B+ Models (GPT-class, Frontier models)",
          requirements: "1.5TB+ VRAM with fast interconnects",
          gpus: "Multi-node H100/H200 clusters with InfiniBand networking",
        },
      ],
      costGuide: `<p>Estimating LLM training costs requires understanding your target model's parameters, token count, and hardware efficiency. A useful starting formula:</p>

<p><strong>Training Cost ≈ (Tokens × 6 × Parameter Count) / (GPU Throughput × GPUs)</strong></p>

<p>As a practical example, fine-tuning LLaMA 3 8B on 10B tokens (approximately 20-30M high-quality samples) requires approximately 48 × 10^12 FLOPs. On an H100 SXM5 (approximately 1,000 TFLOPS for FP16), this translates to roughly 50-60 hours of training time for a single GPU—though multi-GPU scaling with 4-8 GPUs reduces this to 8-15 hours.</p>

<p><strong>Approximate training time examples:</strong></p>
<ul>
<li><strong>7B full fine-tune (10B tokens):</strong> 50-80 hours on 4x RTX 4090 (~$160-250)</li>
<li><strong>13B full fine-tune (10B tokens):</strong> 40-60 hours on 4x A100 80GB (~$300-500)</li>
<li><strong>70B full fine-tune (10B tokens):</strong> 60-80 hours on 8x H100 SXM5 (~$2,000-4,000)</li>
<li><strong>7B LoRA fine-tune (1B tokens):</strong> 4-8 hours on 1x RTX 4090 (~$2-6)</li>
</ul>

<p>For accurate cost estimation, use our <a href="/calculator/cost-estimator">training cost calculator</a> which factors in provider pricing, billing increments, and multi-GPU scaling efficiency.</p>`,
      faqs: [
        {
          q: "What is the minimum GPU for training LLaMA 3 8B?",
          a: "For full fine-tuning LLaMA 3 8B, you need at least 40GB of VRAM (A100 40GB or RTX 4090 with gradient checkpointing). For comfortable training with larger batch sizes, 80GB (A100 80GB or H100) is recommended. LoRA fine-tuning can work with 24GB (RTX 4090, L40S) since adapter layers add minimal parameters.",
        },
        {
          q: "Can I train LLMs on consumer GPUs like RTX 4090?",
          a: "Yes, RTX 4090s are excellent for fine-tuning smaller models (7B and below) and for LoRA training on larger models. However, they lack NVLink, making multi-GPU scaling less efficient. They also have lower reliability and no ECC memory. For production training or models 13B+, enterprise GPUs (A100/H100) are more cost-effective due to better scaling and stability.",
        },
        {
          q: "How many GPUs do I need to train a 70B model?",
          a: "Training a 70B model efficiently requires at least 320GB of effective VRAM. This means 4x H100 SXM5 (80GB each with NVLink), 8x A100 80GB, or a multi-node cluster. The exact count depends on your training technique—full fine-tuning requires more memory than LoRA, and ZeRO-3 optimization can reduce requirements. For most teams, 4-8 enterprise GPUs is the practical range.",
        },
        {
          q: "Is H100 worth the premium over A100 for LLM training?",
          a: "For production training at scale, H100's advantages justify its 2-3x price premium: 60-70% faster training due to Transformer Engine and FP8 support, 2x higher NVLink bandwidth, and better FP8 throughput. For a 70B model training job costing $5,000 in GPU time, H100 might complete in 3 days versus 5+ days on A100—often worth the faster iteration cycle. For smaller teams or fine-tuning, A100 remains the better value.",
        },
        {
          q: "What is better for LLM training: more VRAM or faster interconnects?",
          a: "It depends on your model size relative to single-GPU capacity. If your model fits on one GPU, VRAM and memory bandwidth matter most. Once you need multiple GPUs, interconnect bandwidth becomes the bottleneck—PCIe GPUs scale at 40-60% efficiency, while NVLinked H100s scale at 90%+. For models 13B and larger, prioritizing interconnects (H100 SXM) often beats cheaper PCIe alternatives despite lower total VRAM per dollar.",
        },
        {
          q: "Should I use spot instances for LLM training?",
          a: "Spot instances offer 50-80% cost savings but come with interruption risk. They work well for experimentation and training with frequent checkpointing. For production jobs, design for checkpoint recovery every 5-10 minutes and use spot with automated relaunch. Multi-node distributed training on spot is challenging—one node interruption kills the entire job. For critical training runs, on-demand or reserved capacity is safer despite higher hourly rates.",
        },
      ],
    },
  },
  {
    slug: "fine-tuning",
    name: "fine-tuning",
    summary: "Fine-tune LLMs and diffusion models with balanced VRAM and cost.",
    minVramGb: 24,
    recommendations: { bestOverall: "a100-80gb", bestBudget: "rtx-5090", bestValue: "h100-pcie" },
    related: ["llm-training", "llm-inference", "stable-diffusion"],
  },
  {
    slug: "llm-inference",
    name: "LLM inference",
    summary: "Serve models with low latency, high throughput, and predictable availability.",
    minVramGb: 48,
    recommendations: { bestOverall: "h200-sxm", bestBudget: "l40s", bestValue: "h100-pcie" },
    related: ["production-inference", "model-serving", "rag", "embeddings"],
  },
  {
    slug: "stable-diffusion",
    name: "Stable Diffusion",
    summary: "Generate images with diffusion models; VRAM and cost-per-image matter most.",
    minVramGb: 16,
    recommendations: { bestOverall: "rtx-5090", bestBudget: "rtx-4090", bestValue: "l40s" },
    related: ["image-generation", "comfyui", "video-generation"],
  },
  {
    slug: "image-generation",
    name: "image generation",
    summary: "Optimize for cost-per-image and fast iteration across providers.",
    minVramGb: 16,
    recommendations: { bestOverall: "rtx-5090", bestBudget: "rtx-4090", bestValue: "l40s" },
    related: ["stable-diffusion", "comfyui", "inference"],
  },
  {
    slug: "video-generation",
    name: "video generation",
    summary: "Run video diffusion workloads that benefit from higher VRAM and memory bandwidth.",
    minVramGb: 24,
    recommendations: { bestOverall: "h100-sxm", bestBudget: "rtx-5090", bestValue: "h200-sxm" },
    related: ["stable-diffusion", "image-generation", "text-to-video"],
  },
  {
    slug: "text-to-video",
    name: "text-to-video",
    summary: "Generate video from text prompts using Sora, Runway, or similar models.",
    minVramGb: 48,
    recommendations: { bestOverall: "h200-sxm", bestBudget: "h100-pcie", bestValue: "a100-80gb" },
    related: ["video-generation", "image-generation", "diffusion-models"],
  },
  {
    slug: "comfyui",
    name: "ComfyUI",
    summary: "Pick consumer-friendly GPUs for interactive workflows and pipelines.",
    minVramGb: 16,
    recommendations: { bestOverall: "rtx-5090", bestBudget: "rtx-4090", bestValue: "l40s" },
    related: ["stable-diffusion", "image-generation"],
  },
  {
    slug: "whisper",
    name: "Whisper transcription",
    summary: "Transcribe audio efficiently; cost and availability dominate.",
    minVramGb: 8,
    recommendations: { bestOverall: "l40s", bestBudget: "t4", bestValue: "rtx-4090" },
    related: ["batch-inference", "inference", "speech-synthesis"],
  },
  {
    slug: "speech-synthesis",
    name: "speech synthesis",
    summary: "Generate high-quality speech with TTS models like Bark, VITS, or Tortoise.",
    minVramGb: 12,
    recommendations: { bestOverall: "rtx-4090", bestBudget: "rtx-4080", bestValue: "l40s" },
    related: ["batch-inference", "audio-processing", "multimodal-llm"],
  },
  {
    slug: "rag",
    name: "RAG",
    summary:
      "Run retrieval-augmented generation with room for large KV caches and fast embeddings.",
    minVramGb: 24,
    recommendations: { bestOverall: "h200-sxm", bestBudget: "l40s", bestValue: "a100-80gb" },
    related: ["llm-inference", "embeddings", "multimodal-llm"],
  },
  {
    slug: "embeddings",
    name: "embeddings",
    summary: "High-throughput embedding jobs benefit from stable, cheap inference capacity.",
    minVramGb: 16,
    recommendations: { bestOverall: "l40s", bestBudget: "t4", bestValue: "rtx-4090" },
    related: ["batch-inference", "rag", "vector-database"],
  },
  {
    slug: "vector-database",
    name: "vector database",
    summary: "Run vector search engines like Milvus, Weaviate, or pgvector with GPU acceleration.",
    minVramGb: 24,
    recommendations: { bestOverall: "l40s", bestBudget: "rtx-4090", bestValue: "a100-40gb" },
    related: ["rag", "embeddings", "production-inference"],
  },
  {
    slug: "computer-vision",
    name: "computer vision",
    summary: "Train and serve CV models with balanced compute and memory.",
    minVramGb: 16,
    recommendations: { bestOverall: "l40s", bestBudget: "rtx-4090", bestValue: "a100-40gb" },
    related: ["inference", "ml-research", "3d-rendering"],
  },
  {
    slug: "3d-rendering",
    name: "3D rendering",
    summary: "GPU-accelerated rendering with Blender, Arnold, or V-Ray; CUDA cores matter.",
    minVramGb: 16,
    recommendations: { bestOverall: "rtx-5090", bestBudget: "rtx-4090", bestValue: "l40s" },
    related: ["computer-vision", "image-generation"],
  },
  {
    slug: "molecule-generation",
    name: "molecule generation",
    summary: "Drug discovery and molecular property prediction with graph neural networks.",
    minVramGb: 24,
    recommendations: { bestOverall: "a100-80gb", bestBudget: "rtx-5090", bestValue: "h100-pcie" },
    related: ["ml-research", "scientific-computing"],
  },
  {
    slug: "scientific-computing",
    name: "scientific computing",
    summary: "Numerical simulations, weather modeling, and physics workloads.",
    minVramGb: 48,
    recommendations: { bestOverall: "h100-pcie", bestBudget: "a100-40gb", bestValue: "a100-80gb" },
    related: ["ml-research", "molecule-generation"],
  },
  {
    slug: "batch-inference",
    name: "batch inference",
    summary: "Maximize throughput-per-dollar for offline inference jobs.",
    minVramGb: 16,
    recommendations: { bestOverall: "rtx-5090", bestBudget: "t4", bestValue: "l40s" },
    related: ["embeddings", "whisper", "speech-synthesis"],
  },
  {
    slug: "multi-gpu-training",
    name: "multi-GPU training",
    summary: "Scale training with NVLink and fast networking; node-level pricing matters.",
    minVramGb: 80,
    recommendations: { bestOverall: "h100-sxm", bestBudget: "a100-80gb", bestValue: "b200-sxm" },
    related: ["llm-training", "distributed-training", "gan-training"],
  },
  {
    slug: "distributed-training",
    name: "distributed training",
    summary: "For multi-node training, prioritize InfiniBand, bandwidth, and stable capacity.",
    minVramGb: 80,
    recommendations: { bestOverall: "b200-sxm", bestBudget: "h100-sxm", bestValue: "h200-sxm" },
    related: ["llm-training", "multi-gpu-training", "reinforcement-learning"],
  },
  {
    slug: "reinforcement-learning",
    name: "reinforcement learning",
    summary:
      "RL training with environment simulation; sample efficiency benefits from larger VRAM.",
    minVramGb: 24,
    recommendations: { bestOverall: "h100-pcie", bestBudget: "rtx-5090", bestValue: "a100-80gb" },
    related: ["ml-research", "distributed-training", "multi-gpu-training"],
  },
  {
    slug: "gan-training",
    name: "GAN training",
    summary: "Train generative adversarial networks with stable, long-running GPU capacity.",
    minVramGb: 24,
    recommendations: { bestOverall: "a100-80gb", bestBudget: "rtx-5090", bestValue: "l40s" },
    related: ["image-generation", "multi-gpu-training", "diffusion-models"],
  },
  {
    slug: "diffusion-models",
    name: "diffusion models",
    summary: "Train custom diffusion models with high VRAM for batch processing.",
    minVramGb: 48,
    recommendations: { bestOverall: "h200-sxm", bestBudget: "a100-80gb", bestValue: "h100-sxm" },
    related: ["stable-diffusion", "image-generation", "video-generation"],
  },
  {
    slug: "production-inference",
    name: "production inference",
    summary: "Choose reliable providers with strong SLAs and predictable scaling.",
    minVramGb: 24,
    recommendations: { bestOverall: "h200-sxm", bestBudget: "l40s", bestValue: "h100-pcie" },
    related: ["model-serving", "llm-inference", "vector-database"],
  },
  {
    slug: "model-serving",
    name: "model serving",
    summary: "Serve models with stable endpoints and clear billing increments.",
    minVramGb: 24,
    recommendations: { bestOverall: "h100-pcie", bestBudget: "l40s", bestValue: "a100-80gb" },
    related: ["production-inference", "llm-inference"],
  },
  {
    slug: "multimodal-llm",
    name: "multimodal LLM",
    summary: "Run vision-language models like GPT-4V, LLaVA, or Flamingo.",
    minVramGb: 48,
    recommendations: { bestOverall: "h200-sxm", bestBudget: "a100-80gb", bestValue: "h100-pcie" },
    related: ["llm-inference", "computer-vision", "rag"],
  },
  {
    slug: "ml-research",
    name: "ML research",
    summary: "Balance cost, flexibility, and availability for rapid experimentation.",
    minVramGb: 24,
    recommendations: { bestOverall: "a100-80gb", bestBudget: "rtx-4090", bestValue: "l40s" },
    related: ["fine-tuning", "computer-vision", "scientific-computing"],
  },
  {
    slug: "audio-processing",
    name: "audio processing",
    summary: "Audio enhancement, separation, and analysis workloads.",
    minVramGb: 12,
    recommendations: { bestOverall: "rtx-4090", bestBudget: "rtx-4080", bestValue: "l40s" },
    related: ["whisper", "speech-synthesis", "batch-inference"],
  },
  {
    slug: "neural-search",
    name: "neural search",
    summary: "Semantic search with dense retrieval and reranking models.",
    minVramGb: 24,
    recommendations: { bestOverall: "l40s", bestBudget: "rtx-4090", bestValue: "a100-40gb" },
    related: ["embeddings", "rag", "vector-database"],
  },
  {
    slug: "recommendation-systems",
    name: "recommendation systems",
    summary: "Train and serve recommendation models with high throughput requirements.",
    minVramGb: 24,
    recommendations: { bestOverall: "a100-80gb", bestBudget: "l40s", bestValue: "h100-pcie" },
    related: ["production-inference", "batch-inference", "embeddings"],
  },
  {
    slug: "graph-neural-networks",
    name: "graph neural networks",
    summary: "GNN training for knowledge graphs, social networks, and molecular prediction.",
    minVramGb: 32,
    recommendations: { bestOverall: "a100-80gb", bestBudget: "rtx-5090", bestValue: "h100-pcie" },
    related: ["molecule-generation", "ml-research", "scientific-computing"],
  },
  {
    slug: "inference",
    name: "inference",
    summary: "General-purpose model serving with cost and latency optimization.",
    minVramGb: 16,
    recommendations: { bestOverall: "l40s", bestBudget: "t4", bestValue: "rtx-4090" },
    related: ["batch-inference", "production-inference", "model-serving"],
  },
];

export type RegionPage = { slug: string; name: string; summary: string; exampleRegions: string[] };

export const REGION_PAGES: RegionPage[] = [
  {
    slug: "us-east",
    name: "US East",
    summary: "US East capacity across providers with low latency to East Coast population centers.",
    exampleRegions: ["us-east", "us-east-1", "us-east-2", "eastus"],
  },
  {
    slug: "us-central",
    name: "US Central",
    summary: "Central US GPU capacity with balanced latency to both coasts.",
    exampleRegions: ["us-central", "centralus", "us-central1"],
  },
  {
    slug: "us-west",
    name: "US West",
    summary: "US West capacity across providers with proximity to West Coast tech hubs.",
    exampleRegions: ["us-west", "us-west-1", "us-west-2", "westus"],
  },
  {
    slug: "canada",
    name: "Canada",
    summary: "Canadian GPU cloud capacity for data residency requirements.",
    exampleRegions: ["canada", "ca-central", "canada-1"],
  },
  {
    slug: "uk",
    name: "United Kingdom",
    summary: "UK-based GPU capacity for GDPR compliance and low European latency.",
    exampleRegions: ["uk", "uk-south", "eu-gb", "london"],
  },
  {
    slug: "germany",
    name: "Germany",
    summary: "German GPU cloud capacity with strong data protection (GDGR/BDSG).",
    exampleRegions: ["germany", "germany-west", "eu-de", "frankfurt"],
  },
  {
    slug: "france",
    name: "France",
    summary: "French GPU capacity with EU data residency options.",
    exampleRegions: ["france", "france-central", "eu-fr", "paris"],
  },
  {
    slug: "europe",
    name: "Europe",
    summary: "EU/EEA-friendly regions and providers for data sovereignty.",
    exampleRegions: ["europe", "eu-west", "eu-central", "eu-north"],
  },
  {
    slug: "singapore",
    name: "Singapore",
    summary: "Southeast Asian hub with low latency across APAC region.",
    exampleRegions: ["singapore", "ap-southeast", "asia-southeast1"],
  },
  {
    slug: "japan",
    name: "Japan",
    summary: "Japanese GPU capacity for East Asian markets and local data residency.",
    exampleRegions: ["japan", "ap-northeast", "asia-northeast1"],
  },
  {
    slug: "india",
    name: "India",
    summary: "Indian GPU cloud capacity for South Asian markets and data localization.",
    exampleRegions: ["india", "ap-south", "asia-south1"],
  },
  {
    slug: "australia",
    name: "Australia",
    summary: "Australian GPU capacity for Oceania with data residency compliance.",
    exampleRegions: ["australia", "ap-southeast", "australia-southeast"],
  },
  {
    slug: "asia-pacific",
    name: "Asia Pacific",
    summary: "APAC regions for low-latency access across Asian markets.",
    exampleRegions: ["asia-pacific", "apac", "asia"],
  },
];

export const CALCULATOR_PAGES = [
  {
    slug: "cost-estimator",
    name: "Cost estimator",
    summary: "Estimate total GPU spend for training or inference.",
  },
  {
    slug: "gpu-selector",
    name: "GPU selector",
    summary: "Choose a GPU based on VRAM and budget constraints.",
  },
  {
    slug: "roi-calculator",
    name: "ROI calculator",
    summary: "Estimate savings vs hyperscalers and reserved pricing.",
  },
] as const;
