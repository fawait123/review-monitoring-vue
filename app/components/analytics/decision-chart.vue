<script setup lang="ts">
import { computed } from "vue";
import { VChart, AXIS_COLOR, SPLIT_LINE, TOOLTIP_STYLE } from "~/utils/echarts";

const props = defineProps<{ data: { decision: string; count: number }[] }>();

const DECISION_COLORS: Record<string, string> = {
  APPROVED: "#10b981",
  CHANGES_REQUESTED: "#f59e0b",
  REVIEW_REQUIRED: "#6366f1",
  "(none)": "#64748b",
};

const ready = ref(false);
onMounted(() => requestAnimationFrame(() => (ready.value = true)));

const option = computed(() => ({
  tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, ...TOOLTIP_STYLE },
  grid: { left: 160, right: 16, top: 10, bottom: 8 },
  xAxis: { type: "value", minInterval: 1, axisLabel: { color: AXIS_COLOR, fontSize: 11 }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
  yAxis: {
    type: "category",
    data: props.data.map((d) => d.decision),
    axisLabel: { color: AXIS_COLOR, fontSize: 11 },
  },
  series: [
    {
      type: "bar",
      data: props.data.map((d) => ({
        value: d.count,
        itemStyle: { color: DECISION_COLORS[d.decision] ?? "#6366f1", borderRadius: [0, 4, 4, 0] },
      })),
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
