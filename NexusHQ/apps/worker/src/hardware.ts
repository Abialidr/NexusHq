// Detects this machine's RAM, CPU and GPUs for the admin's "recommended for this PC" list (plan §5.6).
import os from "node:os";
import si from "systeminformation";
import type { Hardware } from "@nexushq/shared";

const GB = 1024 ** 3;
const round = (n: number) => Math.round(n * 10) / 10;

export async function detectHardware(): Promise<Hardware> {
  const [graphics, cpu, mem] = await Promise.all([
    si.graphics().catch(() => ({ controllers: [] as si.Systeminformation.GraphicsControllerData[] })),
    si.cpu().catch(() => null),
    si.mem().catch(() => null),
  ]);
  return {
    ramGb: round((mem?.total ?? os.totalmem()) / GB),
    freeRamGb: round((mem?.available ?? os.freemem()) / GB),
    cpu: cpu ? `${cpu.manufacturer} ${cpu.brand}`.trim() : os.cpus()[0]?.model ?? "unknown",
    cores: cpu?.cores ?? os.cpus().length,
    // vram is in MB; integrated GPUs report shared memory, which recommendLocalModels() ignores by vendor/model.
    gpus: graphics.controllers.map((g) => ({ vendor: g.vendor ?? "", model: g.model ?? "", vramGb: round((g.vram ?? 0) / 1024) })),
    os: `${os.type()} ${os.release()}`,
  };
}
