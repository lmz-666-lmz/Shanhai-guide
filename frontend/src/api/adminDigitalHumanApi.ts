import { apiFetch } from "./http";

export interface DigitalHumanConfig {
  id: number | null;
  name: string;
  avatarText: string;
  roleTitle: string;
  welcomeText: string;
  voiceName: string;
  stylePreset: string;
  enabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface DigitalHumanConfigRequest {
  name: string;
  avatarText: string;
  roleTitle: string;
  welcomeText: string;
  voiceName: string;
  stylePreset: string;
  enabled: boolean;
}

const ADMIN_PATH = "/api/admin/digital-human/configs";

export async function getCurrentDigitalHuman(): Promise<DigitalHumanConfig> {
  return apiFetch<DigitalHumanConfig>("/api/digital-human/current", { fallbackMessage: "获取数字人配置失败" });
}

export async function getDigitalHumanConfigs(): Promise<DigitalHumanConfig[]> {
  return apiFetch<DigitalHumanConfig[]>(ADMIN_PATH, { fallbackMessage: "获取数字人配置列表失败" });
}

export async function createDigitalHumanConfig(data: DigitalHumanConfigRequest): Promise<DigitalHumanConfig> {
  return apiFetch<DigitalHumanConfig>(ADMIN_PATH, { method: "POST", body: JSON.stringify(data), fallbackMessage: "新增数字人配置失败" });
}

export async function updateDigitalHumanConfig(id: number, data: DigitalHumanConfigRequest): Promise<DigitalHumanConfig> {
  return apiFetch<DigitalHumanConfig>(`${ADMIN_PATH}/${id}`, { method: "PUT", body: JSON.stringify(data), fallbackMessage: "编辑数字人配置失败" });
}

export async function setDigitalHumanConfigEnabled(id: number, enabled: boolean): Promise<DigitalHumanConfig> {
  return apiFetch<DigitalHumanConfig>(`${ADMIN_PATH}/${id}/enabled?enabled=${enabled}`, { method: "PATCH", fallbackMessage: "启用数字人配置失败" });
}

export async function deleteDigitalHumanConfig(id: number): Promise<void> {
  return apiFetch<void>(`${ADMIN_PATH}/${id}`, { method: "DELETE", fallbackMessage: "删除数字人配置失败" });
}
