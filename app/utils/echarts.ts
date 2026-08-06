import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { PieChart, BarChart, LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import VChart from "vue-echarts";

use([CanvasRenderer, PieChart, BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent]);

export { VChart };

export const STATE_COLORS: Record<string, string> = {
  OPEN: "#10b981",
  MERGED: "#a855f7",
  CLOSED: "#ef4444",
};

export const STATE_LABEL: Record<string, string> = {
  OPEN: "Open",
  MERGED: "Merged",
  CLOSED: "Closed",
};

export const AXIS_COLOR = "#94a3b8";
export const SPLIT_LINE = "rgba(148,163,184,0.15)";
export const TOOLTIP_STYLE = {
  backgroundColor: "#0f172a",
  borderColor: "#334155",
  borderWidth: 1,
  textStyle: { color: "#e2e8f0", fontSize: 12 },
};
