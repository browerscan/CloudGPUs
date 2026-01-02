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
    extendedContent: {
      introduction: `<p>Fine-tuning has become the most practical approach for adapting foundation models to specific tasks, domains, or behaviors. Unlike full pre-training, which requires billions of tokens and weeks of compute, fine-tuning leverages pre-existing knowledge by updating only a subset of model weights on task-specific data. This dramatically reduces both compute requirements and cost.</p>

<p>The landscape of fine-tuning has evolved significantly with the rise of parameter-efficient methods. Traditional full fine-tuning updates all model parameters and requires similar VRAM to training, but techniques like LoRA (Low-Rank Adaptation), QLoRA, and adapter layers reduce memory requirements by 60-80% while achieving comparable performance. A 7B model that needs 60GB for full fine-tuning can be LoRA-tuned on a single 24GB RTX 4090.</p>

<p>Choosing the best GPU for fine-tuning depends on your target model size, fine-tuning method, and iteration speed requirements. For rapid experimentation with LoRA on 7B-13B models, consumer GPUs offer excellent value. For full fine-tuning of 70B+ models or production-scale adapter training, enterprise GPUs with high memory bandwidth and multi-GPU scaling remain essential.</p>`,
      quickAnswerReasoning: {
        overall:
          "The A100 80GB offers the ideal balance for fine-tuning workloads. Its 80GB VRAM comfortably handles full fine-tuning of 7B-13B models and LoRA training of 70B models without quantization. The 2 TB/s HBM2e bandwidth ensures fast gradient updates, while broad cloud availability means competitive pricing ($2-4/hr) and easy scaling. For most teams fine-tuning open-source models, the A100 80GB delivers enterprise reliability without H100 pricing.",
        budget:
          "The RTX 5090 brings 32GB GDDR7 memory with exceptional bandwidth, making it the new budget champion for fine-tuning. It handles LoRA/QLoRA training of 7B-13B models with ease and can manage full fine-tuning of smaller models. At consumer pricing under $2,000, it offers the best VRAM-per-dollar for teams building fine-tuning clusters. The main limitation is lack of NVLink for efficient multi-GPU scaling.",
        value:
          "The H100 PCIe provides enterprise-grade fine-tuning performance at lower cost than SXM variants. With 80GB HBM3 memory, Transformer Engine for mixed-precision training, and PCIe 5.0 connectivity, it handles the full spectrum of fine-tuning workloads. The PCIe form factor fits standard servers without NVLink infrastructure, making it ideal for teams scaling from A100s who need faster iteration without full data center buildout.",
      },
      vramSection: `<p>Fine-tuning memory requirements vary dramatically based on the technique used. Understanding these differences is crucial for choosing the right GPU.</p>

<p><strong>Full Fine-Tuning Memory Requirements:</strong></p>
<p>Full fine-tuning stores the complete model weights, optimizer states, and gradients. For AdamW with mixed-precision training:</p>
<ul>
<li><strong>Model weights:</strong> 2 bytes per parameter (FP16/BF16)</li>
<li><strong>Optimizer states:</strong> 8 bytes per parameter (FP32 momentum + variance)</li>
<li><strong>Gradients:</strong> 2 bytes per parameter</li>
<li><strong>Activations:</strong> Variable, typically 2-4x model size depending on batch size</li>
</ul>

<p><strong>LoRA/QLoRA Memory Requirements:</strong></p>
<p>LoRA freezes base weights and trains only low-rank adapter matrices. Memory needs drop significantly:</p>
<ul>
<li><strong>Base weights:</strong> 2 bytes per parameter (frozen, no optimizer states)</li>
<li><strong>LoRA adapters:</strong> Typically 0.1-1% of base parameters, with full optimizer states</li>
<li><strong>QLoRA bonus:</strong> 4-bit quantization reduces base weights to 0.5 bytes per parameter</li>
</ul>

<p><strong>Practical VRAM Requirements by Method:</strong></p>
<ul>
<li><strong>7B Full Fine-tune:</strong> 60-80GB (1x A100 80GB or 2x RTX 4090)</li>
<li><strong>7B LoRA:</strong> 18-24GB (1x RTX 4090, L40S)</li>
<li><strong>7B QLoRA:</strong> 10-16GB (1x RTX 4080, RTX 4090)</li>
<li><strong>13B Full Fine-tune:</strong> 100-140GB (2x A100 80GB)</li>
<li><strong>13B LoRA:</strong> 32-48GB (1x L40S, A100 40GB)</li>
<li><strong>13B QLoRA:</strong> 16-24GB (1x RTX 4090)</li>
<li><strong>70B LoRA:</strong> 80-100GB (1x A100 80GB, H100)</li>
<li><strong>70B QLoRA:</strong> 40-48GB (1x L40S, A100 40GB)</li>
</ul>`,
      gpuTable: [
        {
          gpu: "A100 80GB PCIe",
          vram: "80GB HBM2e",
          bestFor: "Full fine-tune 7B-13B, LoRA 70B",
          priceRange: "$2-4/hr",
        },
        {
          gpu: "H100 PCIe (80GB)",
          vram: "80GB HBM3",
          bestFor: "Fast iteration, production fine-tuning",
          priceRange: "$3-5/hr",
        },
        {
          gpu: "RTX 5090",
          vram: "32GB GDDR7",
          bestFor: "LoRA/QLoRA 7B-13B, budget clusters",
          priceRange: "$0.50-1.00/hr",
        },
        {
          gpu: "RTX 4090",
          vram: "24GB GDDR6X",
          bestFor: "QLoRA training, rapid prototyping",
          priceRange: "$0.40-0.80/hr",
        },
        {
          gpu: "L40S",
          vram: "48GB GDDR6",
          bestFor: "LoRA 13B-34B, balanced workloads",
          priceRange: "$0.80-1.50/hr",
        },
        {
          gpu: "A100 40GB PCIe",
          vram: "40GB HBM2e",
          bestFor: "QLoRA 70B, LoRA 7B-13B",
          priceRange: "$1-2/hr",
        },
      ],
      modelSizes: [
        {
          size: "7B Models (Mistral 7B, LLaMA 3 8B)",
          requirements: "Full fine-tune: 60-80GB | LoRA: 18-24GB | QLoRA: 10-16GB",
          gpus: "Full: 1x A100 80GB | LoRA: 1x RTX 4090 | QLoRA: 1x RTX 4080",
        },
        {
          size: "13B Models (LLaMA 13B, Yi 13B)",
          requirements: "Full fine-tune: 100-140GB | LoRA: 32-48GB | QLoRA: 16-24GB",
          gpus: "Full: 2x A100 80GB | LoRA: 1x L40S | QLoRA: 1x RTX 4090",
        },
        {
          size: "34B Models (CodeLlama 34B, Yi 34B)",
          requirements: "Full fine-tune: 280-350GB | LoRA: 60-80GB | QLoRA: 32-40GB",
          gpus: "Full: 4x A100 80GB | LoRA: 1x A100 80GB | QLoRA: 1x L40S",
        },
        {
          size: "70B Models (LLaMA 70B, Qwen 72B)",
          requirements: "Full fine-tune: 500-640GB | LoRA: 80-100GB | QLoRA: 40-48GB",
          gpus: "Full: 8x A100 80GB | LoRA: 2x A100 80GB | QLoRA: 1x L40S",
        },
      ],
      costGuide: `<p>Fine-tuning costs depend heavily on your chosen method, dataset size, and target model. LoRA and QLoRA can reduce compute costs by 5-10x compared to full fine-tuning while achieving 95%+ of the performance.</p>

<p><strong>Typical Fine-Tuning Cost Examples:</strong></p>
<ul>
<li><strong>7B QLoRA (10K samples, 3 epochs):</strong> 2-4 hours on RTX 4090 = $1-3</li>
<li><strong>7B LoRA (100K samples, 3 epochs):</strong> 8-12 hours on RTX 4090 = $4-10</li>
<li><strong>7B Full Fine-tune (100K samples):</strong> 6-10 hours on A100 80GB = $15-40</li>
<li><strong>13B QLoRA (50K samples):</strong> 4-8 hours on RTX 4090 = $2-6</li>
<li><strong>13B LoRA (100K samples):</strong> 10-16 hours on L40S = $10-25</li>
<li><strong>70B QLoRA (10K samples):</strong> 6-12 hours on A100 80GB = $15-50</li>
<li><strong>70B LoRA (50K samples):</strong> 20-40 hours on 2x A100 80GB = $80-300</li>
</ul>

<p><strong>Cost Optimization Strategies:</strong></p>
<ul>
<li>Start with QLoRA for rapid iteration, switch to LoRA for production quality</li>
<li>Use gradient checkpointing to reduce VRAM at cost of 20-30% slower training</li>
<li>Batch size optimization: larger batches improve GPU utilization</li>
<li>Spot instances for iterative experiments (50-70% savings)</li>
<li>Consider on-demand for final production runs to avoid interruption</li>
</ul>`,
      faqs: [
        {
          q: "What is the difference between LoRA and full fine-tuning?",
          a: "Full fine-tuning updates all model parameters, requiring 4-5x the VRAM of inference due to optimizer states and gradients. LoRA (Low-Rank Adaptation) freezes the base model and trains only small adapter matrices (typically 0.1-1% of parameters), reducing VRAM by 60-80%. Performance is typically within 95-99% of full fine-tuning for most tasks, making LoRA the preferred approach for VRAM-constrained setups.",
        },
        {
          q: "Can I fine-tune a 70B model on a single GPU?",
          a: "Yes, using QLoRA (4-bit quantization + LoRA). A 70B model with QLoRA fits in approximately 40-48GB VRAM, allowing fine-tuning on a single L40S or A100 40GB. For LoRA without quantization, you need 80-100GB (A100 80GB or H100). Full fine-tuning of 70B requires 500GB+ VRAM across multiple GPUs.",
        },
        {
          q: "How much data do I need for effective fine-tuning?",
          a: "Quality matters more than quantity. For instruction tuning or chat behavior, 1,000-10,000 high-quality examples often suffice. For domain adaptation (legal, medical, code), 10,000-100,000 domain-specific samples work well. For continued pre-training on new knowledge, you need millions of tokens. Start small (1K samples) to validate your pipeline before scaling.",
        },
        {
          q: "Should I use RTX 4090 or A100 for fine-tuning?",
          a: "For QLoRA on models up to 13B: RTX 4090 offers better value at $0.40-0.80/hr versus $2-4/hr for A100. For LoRA on 13B+ or any full fine-tuning: A100 80GB is necessary due to VRAM requirements. Consider RTX 4090 clusters (4-8 GPUs) for LoRA on larger models, but factor in inefficient multi-GPU scaling without NVLink.",
        },
        {
          q: "How long does fine-tuning take compared to pre-training?",
          a: "Fine-tuning is 100-1000x faster than pre-training. Where pre-training LLaMA 7B took thousands of GPU-hours on massive clusters, fine-tuning the same model on 10K samples takes 2-8 hours on a single A100. QLoRA is even faster. Most fine-tuning jobs complete in hours, not days, making iteration fast and cost-effective.",
        },
        {
          q: "What fine-tuning framework should I use?",
          a: "For most use cases: Hugging Face TRL + PEFT libraries provide the best balance of features and ease-of-use. For maximum performance: Axolotl or LLaMA-Factory offer optimized training loops. For production scale: DeepSpeed ZeRO or FSDP enable efficient multi-GPU training. Start with TRL for prototyping, graduate to specialized frameworks as needed.",
        },
      ],
    },
  },
  {
    slug: "llm-inference",
    name: "LLM inference",
    summary: "Serve models with low latency, high throughput, and predictable availability.",
    minVramGb: 48,
    recommendations: { bestOverall: "h200-sxm", bestBudget: "l40s", bestValue: "h100-pcie" },
    related: ["production-inference", "model-serving", "rag", "embeddings"],
    extendedContent: {
      introduction: `<p>LLM inference presents fundamentally different challenges than training. While training is throughput-bound and runs for hours or days, inference must balance latency (time-to-first-token), throughput (tokens per second), and cost-per-token across millions of requests. The best GPU for LLM inference depends heavily on your serving pattern: interactive chat requires low latency, batch processing prioritizes throughput, and production APIs must balance both.</p>

<p>Modern inference optimization has transformed GPU requirements. Techniques like continuous batching (vLLM, TGI), speculative decoding, PagedAttention, and quantization (AWQ, GPTQ, GGUF) can increase throughput by 3-10x on the same hardware. A well-optimized 70B model serving stack on H100 can achieve 2000+ tokens/second aggregate throughput, compared to 200-300 tok/s with naive implementations.</p>

<p>Memory requirements for inference differ from training: you need space for model weights plus KV cache (which scales with sequence length and batch size). A 70B model in FP16 requires 140GB just for weights, but with INT4 quantization drops to 35GB. The KV cache for 100 concurrent users at 4K context adds another 20-40GB. This is why high-VRAM GPUs like H200 (141GB) dominate production inference deployments.</p>`,
      quickAnswerReasoning: {
        overall:
          "The H200 SXM with 141GB HBM3e represents the pinnacle of inference hardware. Its massive VRAM fits 70B models unquantized with room for large KV caches, enabling 100+ concurrent users at full precision. The 4.8 TB/s memory bandwidth eliminates the memory-bound bottleneck that limits token generation speed. For production inference at scale, H200 delivers the lowest cost-per-token despite high hourly rates.",
        budget:
          "The L40S offers exceptional inference value with 48GB VRAM at $0.80-1.50/hr. It runs quantized 70B models (AWQ/GPTQ) or full-precision 13B models efficiently. While lacking HBM bandwidth, its GDDR6 memory handles moderate batch sizes well. For startups and small-scale deployments serving 10-50 concurrent users, L40S provides production-grade inference without enterprise pricing.",
        value:
          "The H100 PCIe delivers H100-class performance in a more accessible form factor. With 80GB HBM3 and 2 TB/s bandwidth, it handles 70B models in FP8 or quantized formats with excellent throughput. PCIe connectivity means easier integration into existing infrastructure without NVLink requirements. At $3-5/hr, it offers the best performance-per-dollar for teams graduating from A100s.",
      },
      vramSection: `<p>Inference VRAM requirements are dominated by two factors: model weights and KV cache. Understanding this split is crucial for capacity planning.</p>

<p><strong>Model Weight Memory (varies by precision):</strong></p>
<ul>
<li><strong>FP16/BF16:</strong> 2 bytes per parameter (7B = 14GB, 70B = 140GB)</li>
<li><strong>FP8:</strong> 1 byte per parameter (7B = 7GB, 70B = 70GB)</li>
<li><strong>INT4 (AWQ/GPTQ):</strong> 0.5 bytes per parameter (7B = 3.5GB, 70B = 35GB)</li>
</ul>

<p><strong>KV Cache Memory (per user/sequence):</strong></p>
<p>KV cache stores attention keys and values for each token in context. Memory scales with: layers x heads x head_dim x 2 (K+V) x sequence_length x batch_size x precision</p>
<ul>
<li><strong>7B model, 4K context, FP16:</strong> ~500MB per concurrent user</li>
<li><strong>13B model, 4K context, FP16:</strong> ~1GB per concurrent user</li>
<li><strong>70B model, 4K context, FP16:</strong> ~5GB per concurrent user</li>
<li><strong>70B model, 32K context, FP16:</strong> ~40GB per concurrent user</li>
</ul>

<p><strong>Total VRAM Planning Examples:</strong></p>
<ul>
<li><strong>7B FP16, 50 users @ 4K:</strong> 14GB weights + 25GB KV = 39GB (L40S)</li>
<li><strong>13B INT4, 100 users @ 4K:</strong> 6.5GB weights + 50GB KV = 56GB (A100 80GB)</li>
<li><strong>70B INT4, 50 users @ 4K:</strong> 35GB weights + 125GB KV = 160GB (2x H100 or 1x H200)</li>
<li><strong>70B FP16, 20 users @ 8K:</strong> 140GB weights + 80GB KV = 220GB (2x H200)</li>
</ul>

<p>Modern inference engines like vLLM use PagedAttention to dynamically allocate KV cache, improving memory efficiency by 2-4x compared to static allocation.</p>`,
      gpuTable: [
        {
          gpu: "H200 SXM (141GB)",
          vram: "141GB HBM3e",
          bestFor: "70B+ unquantized, high concurrency",
          priceRange: "$5-10/hr",
        },
        {
          gpu: "H100 SXM5 (80GB)",
          vram: "80GB HBM3",
          bestFor: "70B quantized, production serving",
          priceRange: "$4-8/hr",
        },
        {
          gpu: "H100 PCIe (80GB)",
          vram: "80GB HBM3",
          bestFor: "Balanced inference, standard servers",
          priceRange: "$3-5/hr",
        },
        {
          gpu: "L40S",
          vram: "48GB GDDR6",
          bestFor: "13B-34B models, cost-effective serving",
          priceRange: "$0.80-1.50/hr",
        },
        {
          gpu: "A100 80GB PCIe",
          vram: "80GB HBM2e",
          bestFor: "70B quantized, proven reliability",
          priceRange: "$2-4/hr",
        },
        {
          gpu: "RTX 4090",
          vram: "24GB GDDR6X",
          bestFor: "7B-13B models, development/testing",
          priceRange: "$0.40-0.80/hr",
        },
      ],
      modelSizes: [
        {
          size: "7B Models (Mistral 7B, LLaMA 3 8B)",
          requirements: "14GB FP16 | 7GB FP8 | 3.5GB INT4 + KV cache",
          gpus: "RTX 4090 (24GB) | L40S (48GB) for high concurrency",
        },
        {
          size: "13B Models (LLaMA 13B, CodeLlama 13B)",
          requirements: "26GB FP16 | 13GB FP8 | 6.5GB INT4 + KV cache",
          gpus: "L40S (48GB) | A100 40GB for production scale",
        },
        {
          size: "34B Models (CodeLlama 34B, Yi 34B)",
          requirements: "68GB FP16 | 34GB FP8 | 17GB INT4 + KV cache",
          gpus: "A100 80GB | H100 PCIe for high throughput",
        },
        {
          size: "70B Models (LLaMA 70B, Qwen 72B)",
          requirements: "140GB FP16 | 70GB FP8 | 35GB INT4 + KV cache",
          gpus: "H200 SXM (unquantized) | 2x H100 or H100 + INT4",
        },
        {
          size: "Mixture of Experts (Mixtral 8x7B, DBRX)",
          requirements: "90GB FP16 | 45GB FP8 | 23GB INT4 (active params lower)",
          gpus: "H100 SXM (80GB) | A100 80GB with quantization",
        },
      ],
      costGuide: `<p>Inference cost optimization focuses on maximizing tokens-per-dollar while meeting latency requirements. The economics vary significantly between interactive and batch workloads.</p>

<p><strong>Tokens Per Second by GPU (70B model, INT4 quantized, vLLM):</strong></p>
<ul>
<li><strong>H200 SXM:</strong> 80-120 tok/s per user, 2000+ aggregate throughput</li>
<li><strong>H100 SXM:</strong> 60-90 tok/s per user, 1500+ aggregate throughput</li>
<li><strong>H100 PCIe:</strong> 50-70 tok/s per user, 1200+ aggregate throughput</li>
<li><strong>A100 80GB:</strong> 30-50 tok/s per user, 800+ aggregate throughput</li>
<li><strong>L40S:</strong> 25-40 tok/s per user, 600+ aggregate throughput</li>
</ul>

<p><strong>Cost Per Million Tokens (approximate):</strong></p>
<ul>
<li><strong>H200 @ $8/hr:</strong> $0.80-1.20 per million output tokens</li>
<li><strong>H100 SXM @ $5/hr:</strong> $0.70-1.00 per million output tokens</li>
<li><strong>H100 PCIe @ $4/hr:</strong> $0.80-1.20 per million output tokens</li>
<li><strong>A100 80GB @ $3/hr:</strong> $1.00-1.50 per million output tokens</li>
<li><strong>L40S @ $1/hr:</strong> $0.80-1.30 per million output tokens</li>
</ul>

<p><strong>Cost Optimization Strategies:</strong></p>
<ul>
<li>Use INT4/INT8 quantization (AWQ, GPTQ) for 2-3x cost reduction with minimal quality loss</li>
<li>Implement continuous batching (vLLM, TGI) for 3-5x throughput improvement</li>
<li>Right-size your GPU: L40S beats H100 cost-per-token for low-concurrency workloads</li>
<li>Consider speculative decoding for 1.5-2x speedup on long generations</li>
<li>Use spot instances for batch inference (50-70% savings)</li>
</ul>`,
      faqs: [
        {
          q: "What is the best GPU for serving LLaMA 70B in production?",
          a: "For unquantized FP16 serving: H200 SXM (141GB) fits the full model with room for KV cache. For quantized serving: H100 PCIe or SXM (80GB) with INT4/INT8 quantization offers excellent throughput at lower cost. A100 80GB also works well with quantization. For cost-sensitive deployments, 2x L40S with tensor parallelism can serve quantized 70B models effectively.",
        },
        {
          q: "How does quantization affect inference quality and speed?",
          a: "Modern quantization (AWQ, GPTQ, INT8) reduces model size by 2-4x with typically less than 1% quality degradation on benchmarks. Speed improvements vary: INT4 on Ampere/Hopper GPUs can be 1.5-2x faster due to reduced memory bandwidth requirements. The quality trade-off is usually worth it for production serving. Always benchmark your specific use case.",
        },
        {
          q: "What is the difference between time-to-first-token and throughput?",
          a: "Time-to-first-token (TTFT) measures latency until the first response token appears, critical for interactive applications. Throughput measures total tokens generated per second. A GPU can have excellent throughput but poor TTFT if batching is aggressive. For chat applications, optimize TTFT (target <500ms). For batch processing, maximize throughput.",
        },
        {
          q: "Should I use tensor parallelism or run multiple model replicas?",
          a: "Tensor parallelism splits one model across GPUs, reducing per-request latency but requiring fast interconnects (NVLink). Multiple replicas run independent model copies, scaling throughput linearly without interconnect requirements. For latency-sensitive workloads: tensor parallelism. For throughput-focused batch inference: replicas. Most production deployments use replicas unless serving 70B+ models where single-GPU VRAM is insufficient.",
        },
        {
          q: "What inference framework should I use for production?",
          a: "vLLM is the most popular choice, offering PagedAttention for memory efficiency and continuous batching for throughput. TGI (Text Generation Inference) from Hugging Face provides similar features with easier deployment. TensorRT-LLM offers maximum performance but requires more setup. For getting started: vLLM. For Hugging Face ecosystem: TGI. For maximum optimization: TensorRT-LLM.",
        },
        {
          q: "How many concurrent users can one GPU handle?",
          a: "It depends on model size, context length, and acceptable latency. Rough guidelines for 4K context: 7B model on RTX 4090: 20-50 users. 13B on L40S: 30-60 users. 70B quantized on H100: 50-100 users. These assume continuous batching (vLLM) and 500ms target TTFT. Higher concurrency is possible with longer acceptable latency or shorter contexts.",
        },
      ],
    },
  },
  {
    slug: "stable-diffusion",
    name: "Stable Diffusion",
    summary: "Generate images with diffusion models; VRAM and cost-per-image matter most.",
    minVramGb: 16,
    recommendations: { bestOverall: "rtx-5090", bestBudget: "rtx-4090", bestValue: "l40s" },
    related: ["image-generation", "comfyui", "video-generation"],
    extendedContent: {
      introduction: `<p>Stable Diffusion has revolutionized AI image generation, but the GPU requirements vary dramatically between model versions. The original SD 1.5 runs comfortably on 8GB GPUs, while SDXL needs 12-16GB, and newer Flux models demand 24GB+ for quality results. Choosing the best GPU for Stable Diffusion depends on which models you run, your batch size, and whether you prioritize generation speed or cost-per-image.</p>

<p>Unlike LLM workloads that are memory-bandwidth bound, image generation is more compute-intensive during the denoising steps. This makes consumer GPUs with high CUDA core counts excellent choices. The RTX 4090 generates SDXL images 2-3x faster than an RTX 3090 despite similar VRAM. The newer RTX 5090 pushes this further with architectural improvements and 32GB VRAM that handles Flux models without compression.</p>

<p>For production image generation, the calculus shifts toward throughput and reliability. While consumer GPUs offer the best single-image speed, enterprise GPUs like L40S provide higher sustained throughput, better batch processing, and datacenter reliability. The choice between consumer and enterprise depends on your deployment model: interactive generation favors RTX cards, while API-based batch generation benefits from L40S or multiple GPU setups.</p>`,
      quickAnswerReasoning: {
        overall:
          "The RTX 5090 represents the new gold standard for Stable Diffusion with 32GB GDDR7 and massively improved compute. It handles SD 1.5, SDXL, and Flux models at maximum quality without VRAM constraints. Generation speeds exceed 2 images/second for SDXL at 1024x1024. For creators and studios needing the fastest iteration, RTX 5090 delivers unmatched performance. The consumer-grade pricing ($1,999 MSRP) makes it accessible compared to enterprise alternatives.",
        budget:
          "The RTX 4090 remains the budget champion for Stable Diffusion. Its 24GB VRAM handles SDXL comfortably and runs Flux models with some optimization. At $0.40-0.80/hr cloud pricing or $1,600 purchase, it delivers exceptional value. Generation speed of 1-1.5 images/second for SDXL makes it viable for production workflows. The only limitation is Flux at highest settings, where 24GB becomes tight.",
        value:
          "The L40S offers 48GB VRAM at enterprise reliability, making it ideal for production Stable Diffusion deployments. It runs Flux models without VRAM concerns, handles large batch sizes, and provides consistent performance. At $0.80-1.50/hr, it costs more than RTX 4090 but delivers 2x the VRAM and datacenter-grade uptime. Perfect for API-based image generation services that need reliability over raw speed.",
      },
      vramSection: `<p>Stable Diffusion VRAM requirements depend on the model architecture, image resolution, and optimization techniques used.</p>

<p><strong>Base Model VRAM Requirements:</strong></p>
<ul>
<li><strong>SD 1.5 (512x512):</strong> 4-6GB minimum, 8GB comfortable</li>
<li><strong>SD 2.1 (768x768):</strong> 6-8GB minimum, 12GB comfortable</li>
<li><strong>SDXL Base (1024x1024):</strong> 8-10GB minimum, 16GB comfortable</li>
<li><strong>SDXL + Refiner:</strong> 12-16GB minimum, 24GB comfortable</li>
<li><strong>Flux.1 Dev (1024x1024):</strong> 16-20GB minimum, 24GB comfortable</li>
<li><strong>Flux.1 Pro:</strong> 20-24GB minimum, 32GB comfortable</li>
</ul>

<p><strong>VRAM Scaling Factors:</strong></p>
<ul>
<li><strong>Resolution:</strong> VRAM scales roughly quadratically with resolution. 2048x2048 needs 4x the VRAM of 1024x1024</li>
<li><strong>Batch size:</strong> Each additional image in batch adds ~2-4GB for SDXL</li>
<li><strong>ControlNet:</strong> Adds 2-4GB depending on model</li>
<li><strong>LoRA/IP-Adapter:</strong> Adds 0.5-2GB per adapter loaded</li>
<li><strong>Upscalers:</strong> 4x upscaling models need 2-6GB additional</li>
</ul>

<p><strong>Optimization Techniques for Limited VRAM:</strong></p>
<ul>
<li><strong>FP16 precision:</strong> Default for most workflows, halves VRAM vs FP32</li>
<li><strong>Model offloading:</strong> Moves unused components to CPU RAM (slower but works)</li>
<li><strong>Attention slicing:</strong> Trades speed for VRAM, enables larger images on smaller GPUs</li>
<li><strong>VAE tiling:</strong> Enables high-resolution decoding on limited VRAM</li>
<li><strong>xformers/Flash Attention:</strong> 20-30% VRAM reduction with speed improvement</li>
</ul>`,
      gpuTable: [
        {
          gpu: "RTX 5090",
          vram: "32GB GDDR7",
          bestFor: "Flux models, maximum speed",
          priceRange: "$0.60-1.20/hr",
        },
        {
          gpu: "RTX 4090",
          vram: "24GB GDDR6X",
          bestFor: "SDXL, general production",
          priceRange: "$0.40-0.80/hr",
        },
        {
          gpu: "L40S",
          vram: "48GB GDDR6",
          bestFor: "Enterprise batch generation",
          priceRange: "$0.80-1.50/hr",
        },
        {
          gpu: "RTX 4080",
          vram: "16GB GDDR6X",
          bestFor: "SDXL with optimizations",
          priceRange: "$0.30-0.50/hr",
        },
        {
          gpu: "A100 40GB",
          vram: "40GB HBM2e",
          bestFor: "Large batch, high throughput",
          priceRange: "$1-2/hr",
        },
        {
          gpu: "RTX 3090",
          vram: "24GB GDDR6X",
          bestFor: "Budget SDXL, legacy option",
          priceRange: "$0.30-0.50/hr",
        },
      ],
      modelSizes: [
        {
          size: "SD 1.5 (512x512 base)",
          requirements: "4-6GB VRAM minimum, 8GB for comfort",
          gpus: "RTX 3060 12GB | RTX 4070 | Any 12GB+ GPU",
        },
        {
          size: "SDXL Base (1024x1024)",
          requirements: "10-12GB minimum, 16GB for batch generation",
          gpus: "RTX 4080 | RTX 4090 | RTX 3090",
        },
        {
          size: "SDXL + Refiner Pipeline",
          requirements: "16-20GB for smooth workflow",
          gpus: "RTX 4090 | L40S | RTX 5090",
        },
        {
          size: "Flux.1 Dev/Schnell",
          requirements: "20-24GB for native resolution",
          gpus: "RTX 4090 (tight) | RTX 5090 | L40S",
        },
        {
          size: "Flux.1 Pro / High-res workflows",
          requirements: "24-32GB for maximum quality",
          gpus: "RTX 5090 | L40S | A100 40GB",
        },
      ],
      costGuide: `<p>Image generation costs scale with generation speed and GPU pricing. The key metric is cost-per-image rather than hourly rate.</p>

<p><strong>Images Per Second (SDXL 1024x1024, 30 steps):</strong></p>
<ul>
<li><strong>RTX 5090:</strong> 2.0-2.5 images/second</li>
<li><strong>RTX 4090:</strong> 1.2-1.5 images/second</li>
<li><strong>L40S:</strong> 0.8-1.0 images/second</li>
<li><strong>RTX 4080:</strong> 0.7-0.9 images/second</li>
<li><strong>A100 40GB:</strong> 0.6-0.8 images/second</li>
<li><strong>RTX 3090:</strong> 0.5-0.7 images/second</li>
</ul>

<p><strong>Cost Per 1,000 Images (SDXL 1024x1024):</strong></p>
<ul>
<li><strong>RTX 5090 @ $1/hr:</strong> $0.15-0.20 per 1K images</li>
<li><strong>RTX 4090 @ $0.50/hr:</strong> $0.10-0.15 per 1K images</li>
<li><strong>L40S @ $1/hr:</strong> $0.30-0.40 per 1K images</li>
<li><strong>A100 40GB @ $1.50/hr:</strong> $0.50-0.70 per 1K images</li>
</ul>

<p><strong>Cost Optimization Strategies:</strong></p>
<ul>
<li>Use SDXL Turbo/Lightning for 4-8 step generation (5-10x faster)</li>
<li>Batch generation improves GPU utilization</li>
<li>Compile models with torch.compile() for 20-30% speedup</li>
<li>Use FP16 precision (default) - FP32 is unnecessary</li>
<li>Consider spot instances for batch generation (50-70% savings)</li>
</ul>`,
      faqs: [
        {
          q: "What is the minimum GPU for Stable Diffusion XL?",
          a: "SDXL requires 10-12GB VRAM minimum for basic generation at 1024x1024. An RTX 3060 12GB works with optimizations (attention slicing, model offloading) but is slow. For comfortable usage, 16GB (RTX 4080, RTX 4070 Ti Super) is recommended. For production workflows with ControlNet and multiple LoRAs, 24GB (RTX 4090) provides headroom.",
        },
        {
          q: "Can I run Flux models on RTX 4090?",
          a: "Yes, but it is tight. Flux.1 Dev runs on RTX 4090 24GB with optimizations like model offloading or reduced precision. Native quality generation at 1024x1024 works, but higher resolutions or complex workflows may require VRAM management. For unrestricted Flux usage, RTX 5090 (32GB) or L40S (48GB) is recommended.",
        },
        {
          q: "Is RTX 4090 or A100 better for Stable Diffusion?",
          a: "For raw generation speed: RTX 4090 wins convincingly, producing 1.5-2x more images per second than A100 40GB. RTX 4090 is optimized for the tensor operations in diffusion models. A100 only makes sense for very large batch sizes or when you need HBM bandwidth for other workloads. For pure image generation, RTX 4090 is the better choice.",
        },
        {
          q: "How many images can I generate per hour?",
          a: "At SDXL 1024x1024 with 30 steps: RTX 4090 generates ~4,500-5,500 images/hour. RTX 5090 reaches 7,000-9,000 images/hour. Using Turbo/Lightning models (4-8 steps), multiply by 4-8x. SD 1.5 at 512x512 is even faster. Actual throughput depends on your pipeline complexity (ControlNet, upscaling, etc.).",
        },
        {
          q: "Should I use ComfyUI or Automatic1111 for production?",
          a: "ComfyUI offers better performance and more control for production pipelines, with node-based workflow that enables complex automation. Automatic1111 (now Forge) is more user-friendly for experimentation. For API-based generation, consider dedicated inference servers like InvokeAI or simple FastAPI wrappers around diffusers. ComfyUI with API mode is increasingly popular for production.",
        },
        {
          q: "What GPU should I buy for a local Stable Diffusion setup?",
          a: "For hobbyist use: RTX 4070 Ti Super (16GB) handles SDXL well at $800. For serious production: RTX 4090 (24GB) at $1,600 is the sweet spot. For future-proofing with Flux: RTX 5090 (32GB) when available. Avoid GPUs under 12GB VRAM as they struggle with modern models. AMD GPUs work but NVIDIA has better software support.",
        },
      ],
    },
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
