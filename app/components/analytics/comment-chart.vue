<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { VChart, AXIS_COLOR, SPLIT_LINE, TOOLTIP_STYLE } from "~/utils/echarts";

const props = defineProps<{ data: { repo: string; author: string; count: number }[] }>();

const ready = ref(false);
onMounted(() => requestAnimationFrame(() => (ready.value = true)));

const labels = computed(() =>
  props.data.map((d) => {
    const repo = d.repo.split("/").pop() ?? d.repo;
    return `${repo} · ${d.author}`;
  }),
);

const option = computed(() => ({
  tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, ...TOOLTIP_STYLE },
  grid: { left: 160, right: 16, top: 10, bottom: 8 },
  xAxis: { type: "value", minInterval: 1, axisLabel: { color: AXIS_COLOR, fontSize: 11 }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
  yAxis: {
    type: "category",
    data: labels.value,
    axisLabel: { color: AXIS_COLOR, fontSize: 10, formatter: (v: string) => (v.length > 20 ? v.slice(0, 19) + "…" : v) },
  },
  series: [
    {
      type: "bar",
      data: props.data.map((d) => d.count),
      itemStyle: { color: "#8b5cf6", borderRadius: [0, 4, 4, 0] },
      barMaxWidth: 28,
    },
  ],
}));
</script>

<template>
  <div v-if="ready" class="h-65 w-full">
    <VChart class="h-full w-full" :option="option" autoresize />
  </div>
</template>