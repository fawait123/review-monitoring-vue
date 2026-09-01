import { ref } from "vue";
import type { Prd, PrdTask, PrdStackInput } from "~~/shared/types";

export function usePrd() {
  const prds = ref<Prd[]>([]);
  const loading = ref(false);

  const list = async () => {
    loading.value = true;
    try {
      const data = await $fetch<{ prds: Prd[] }>("/api/prd");
      prds.value = data.prds;
    } finally {
      loading.value = false;
    }
  };

  const createStream = async (
    prompt: string,
    stack: PrdStackInput,
    onDelta: (text: string) => void,
  ): Promise<Prd> => {
    const res = await fetch("/api/prd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, stack }),
    });
    if (!res.body) throw new Error("Response tak punya body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let prd: Prd | null = null;
    let errMsg: string | null = null;

    const process = (line: string) => {
      if (!line.startsWith("data: ")) return;
      const json = JSON.parse(line.slice(6));
      if (json?.type === "delta") onDelta(json.text);
      else if (json?.type === "done") prd = json.prd as Prd;
      else if (json?.type === "error") errMsg = json.error;
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        // satu event bisa multi-baris; ambil data: (SSE kita selalu 1 baris)
        if (chunk.startsWith("data: ")) process(chunk);
      }
    }
    if (errMsg) throw new Error(errMsg);
    if (!prd) throw new Error("Stream selesai tanpa hasil PRD");
    return prd;
  };

  const get = async (id: number): Promise<{ prd: Prd; tasks: PrdTask[] }> => {
    return $fetch<{ prd: Prd; tasks: PrdTask[] }>(`/api/prd/${id}`);
  };

  const update = async (id: number, body: Record<string, unknown>): Promise<Prd> => {
    const data = await $fetch<{ prd: Prd }>(`/api/prd/${id}`, { method: "PUT", body });
    return data.prd;
  };

  const breakdown = async (id: number): Promise<PrdTask[]> => {
    const data = await $fetch<{ tasks: PrdTask[] }>(`/api/prd/${id}/breakdown`, { method: "POST" });
    return data.tasks;
  };

  const updateTask = async (taskId: number, body: Record<string, unknown>): Promise<void> => {
    await $fetch(`/api/prd/tasks/${taskId}`, { method: "PUT", body });
  };

  const push = async (id: number, body: { repo?: string }): Promise<{ pr: { number: number; url: string }; taskCount: number }> => {
    return $fetch<{ pr: { number: number; url: string }; taskCount: number }>(`/api/prd/${id}/push`, {
      method: "POST",
      body,
    });
  };

  const listRepos = async (): Promise<string[]> => {
    const data = await $fetch<{ repos: string[] }>("/api/prd/repos");
    return data.repos;
  };

  return { prds, loading, list, createStream, get, update, breakdown, updateTask, push, listRepos };
}
