// Which local models fit the worker's machine (docs/UPWORK_AGENT_PLAN.md §5.6). The worker reports Hardware in
// its heartbeat; the admin ranks local models with recommendLocalModels(). Edit LOCAL_MODELS to change the picks.

export interface Gpu {
  vendor: string;
  model: string;
  vramGb: number;
}

export interface Hardware {
  ramGb: number;
  freeRamGb: number;
  cpu: string;
  cores: number;
  gpus: Gpu[];
  os: string;
}

export interface LocalModel {
  id: string;     // Ollama tag
  params: string;
  sizeGb: number; // approx. download / memory size at the default quantization
}

export const LOCAL_MODELS: LocalModel[] = [
  { id: "qwen3:1.7b", params: "1.7B", sizeGb: 1.4 },
  { id: "qwen3:4b", params: "4B", sizeGb: 2.5 },
  { id: "qwen3:8b", params: "8B", sizeGb: 5.2 },
  { id: "qwen3:14b", params: "14B", sizeGb: 9.3 },
  { id: "qwen3:30b", params: "30B (MoE)", sizeGb: 19 },
];

export type Fit = "recommended" | "ok" | "slow" | "too_big";

export interface RankedModel extends LocalModel {
  fit: Fit;
  why: string;
}

// A GPU counts only with dedicated VRAM (integrated Intel/AMD graphics share system RAM and run models on the CPU).
export function dedicatedVramGb(hw: Hardware): number {
  const integrated = /intel|iris|uhd|radeon\(tm\) graphics|microsoft basic/i;
  return Math.max(0, ...hw.gpus.filter((g) => !integrated.test(`${g.vendor} ${g.model}`)).map((g) => g.vramGb));
}

// Rule of thumb: model ≤ ~60% of VRAM on a GPU, ≤ ~40% of total RAM on the CPU (leaves room for the OS and the
// context window). The smallest/fastest model that fits comfortably is the recommendation, since the filter runs
// on every job and a 4B–8B model is enough for a yes/no relevance call.
export function recommendLocalModels(hw: Hardware | null | undefined): RankedModel[] {
  if (!hw || !hw.ramGb) return LOCAL_MODELS.map((m) => ({ ...m, fit: "ok", why: "Worker hasn't reported hardware yet" }));
  const vram = dedicatedVramGb(hw);
  const onGpu = vram >= 4;
  const budget = onGpu ? vram * 0.6 : hw.ramGb * 0.4;
  const pick = onGpu
    ? (vram >= 16 ? "qwen3:14b" : vram >= 8 ? "qwen3:8b" : "qwen3:4b")
    : (hw.ramGb >= 16 ? "qwen3:4b" : "qwen3:1.7b");

  return LOCAL_MODELS.map((m) => {
    if (m.id === pick) return { ...m, fit: "recommended", why: onGpu ? `Fits your ${vram} GB GPU with room to spare` : `Best speed/quality on CPU with ${hw.ramGb} GB RAM` };
    if (m.sizeGb > (onGpu ? hw.ramGb * 0.5 : hw.ramGb * 0.6)) return { ...m, fit: "too_big", why: "Too large for this machine" };
    if (m.sizeGb > budget) return { ...m, fit: "slow", why: onGpu ? "Spills out of VRAM; slow" : "Runs on CPU; few tokens/sec" };
    if (!onGpu && m.sizeGb > 6) return { ...m, fit: "slow", why: "Runs on CPU; few tokens/sec" };
    return { ...m, fit: "ok", why: "Fits" };
  });
}

export function describeHardware(hw: Hardware | null | undefined): string {
  if (!hw || !hw.ramGb) return "unknown";
  const vram = dedicatedVramGb(hw);
  const gpu = hw.gpus[0] ? `${hw.gpus[0].model}${vram ? ` (${vram} GB)` : " (no dedicated VRAM)"}` : "no GPU";
  return `${hw.cpu} · ${hw.cores} cores · ${hw.ramGb} GB RAM · ${gpu}`;
}
