export interface Envelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', signal });
  const json = (await response.json()) as Envelope<T>;
  if (!response.ok || json.success === false) {
    throw new Error(json.message || `请求失败 (${response.status})`);
  }
  if (json.data === undefined) throw new Error('服务返回的数据不完整');
  return json.data;
}

/** An obsolete request must never replace a newer search or update an unmounted page. */
export class RequestLane {
  private generation = 0;
  private controller?: AbortController;

  begin() {
    this.cancel();
    const generation = this.generation;
    const controller = (this.controller = new AbortController());
    return {
      signal: controller.signal,
      isCurrent: () => generation === this.generation && !controller.signal.aborted,
    };
  }

  cancel() {
    this.generation += 1;
    this.controller?.abort();
    this.controller = undefined;
  }
}
