<script setup lang="ts">
import { computed } from "vue";
import { VChart, STATE_COLORS, STATE_LABEL, AXIS_COLOR, SPLIT_LINE, TOOLTIP_STYLE } from "~/utils/echarts";

const props = defineProps<{ data: { repo: string; OPEN: number; MERGED: number; CLOSED: number }[] }>();

const ready = ref(false);
onMounted(() => requestAnimationFrame(() => (ready.value = true)));

const option = computed(() => ({
  tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, ...TOOLTIP_STYLE },
  legend: { bottom: 0, textStyle: { color: AXIS_COLOR }, itemWidth: 12, itemHeight: 8 },
  grid: { left: 180, right: 16, top: 10, bottom: 32 },
  xAxis: { type: "value", minInterval: 1, axisLabel: { color: AXIS_COLOR, fontSize: 11 }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
  yAxis: {
    type: "category",
    data: props.data.map((d) => d.repo),
    axisLabel: { color: AXIS_COLOR, fontSize: 10, formatter: (v: string) => (v.length > 20 ? v.slice(0, 19) + "…" : v) },
  },
  series: [
    { name: STATE_LABEL.OPEN, type: "bar", stack: "a", data: props.data.map((d) => d.OPEN), itemStyle: { color: STATE_COLORS.OPEN } },
    { name: STATE_LABEL.MERGED, type: "bar", stack: "a", data: props.data.map((d) => d.MERGED), itemStyle: { color: STATE_COLORS.MERGED } },
    { name: STATE_LABEL.CLOSED, type: "bar", stack: "a", data: props.data.map((d) => d.CLOSED), itemStyle: { color: STATE_COLORS.CLOSED, borderRadius: [0, 4, 4, 0] } },
  ],
}));
</script>

<template>
  <div v-if="ready" class="h-80 w-full">
    <VChart class="h-full w-full" :option="option" autoresize />
  </div>
</template>
