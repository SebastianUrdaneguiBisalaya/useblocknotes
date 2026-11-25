import { Text, View } from "@react-pdf/renderer";
import {
  type Block,
  type BlockRenderProps,
  defineBlock,
} from "@useblocknotes/core";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as z from "zod";

const chartSchema = z.object({
  data: z
    .array(
      z.object({
        label: z.string(),
        value: z.number(),
      }),
    )
    .min(1),
  kind: z.enum([
    "bar",
    "line",
  ]),
});

/** Props of the chart block: its kind and one value per label. */
export type ChartProps = z.infer<typeof chartSchema>;

const COLOR = "#2563eb";
const PDF_HEIGHT = 120;

function ChartView({ data, kind }: ChartProps): ReactNode {
  const axes = [
    <CartesianGrid
      key="grid"
      strokeDasharray="3 3"
    />,
    <XAxis
      dataKey="label"
      key="x"
    />,
    <YAxis key="y" />,
    <Tooltip key="tooltip" />,
  ];
  return (
    <ResponsiveContainer
      height={240}
      width="100%"
    >
      {kind === "bar" ? (
        <BarChart
          data={[
            ...data,
          ]}
        >
          {axes}
          <Bar
            dataKey="value"
            fill={COLOR}
            isAnimationActive={false}
          />
        </BarChart>
      ) : (
        <LineChart
          data={[
            ...data,
          ]}
        >
          {axes}
          <Line
            dataKey="value"
            isAnimationActive={false}
            stroke={COLOR}
            strokeWidth={2}
          />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

function Chart({
  block,
  editable,
  updateProps,
}: BlockRenderProps<"chart", ChartProps>): ReactNode {
  const { data, kind } = block.props;
  const setPoint = (index: number, point: ChartProps["data"][number]): void =>
    updateProps({
      data: data.map((current, i) => (i === index ? point : current)),
      kind,
    });
  return (
    <div
      className="sb-chart"
      contentEditable={false}
    >
      <ChartView
        data={data}
        kind={kind}
      />
      {editable ? (
        <div className="sb-block-actions">
          <select
            aria-label="Chart kind"
            onChange={(event) =>
              updateProps({
                data,
                kind: event.target.value === "line" ? "line" : "bar",
              })
            }
            value={kind}
          >
            <option value="bar">Bar</option>
            <option value="line">Line</option>
          </select>
          {data.map((point, index) => (
            <span
              className="sb-chart-point"
              key={`point-${index.toString()}`}
            >
              <input
                aria-label={`Label ${index + 1}`}
                onChange={(event) =>
                  setPoint(index, {
                    ...point,
                    label: event.target.value,
                  })
                }
                value={point.label}
              />
              <input
                aria-label={`Value ${index + 1}`}
                onChange={(event) =>
                  setPoint(index, {
                    ...point,
                    value: Number(event.target.value) || 0,
                  })
                }
                type="number"
                value={point.value}
              />
            </span>
          ))}
          <button
            onClick={() =>
              updateProps({
                data: [
                  ...data,
                  {
                    label: `Item ${data.length + 1}`,
                    value: 0,
                  },
                ],
                kind,
              })
            }
            type="button"
          >
            Add value
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** A simple bar chart drawn with react-pdf views (no SVG needed). */
function ChartPdf({
  block,
}: {
  readonly block: Block<"chart", ChartProps>;
}): ReactNode {
  const { data } = block.props;
  const max = Math.max(1, ...data.map((point) => point.value));
  return (
    <View
      style={{
        alignItems: "flex-end",
        flexDirection: "row",
        gap: 8,
      }}
    >
      {data.map((point, index) => (
        <View
          key={`point-${index.toString()}`}
          style={{
            alignItems: "center",
            flex: 1,
          }}
        >
          <Text
            style={{
              fontSize: 9,
            }}
          >
            {point.value}
          </Text>
          <View
            style={{
              backgroundColor: COLOR,
              height: (Math.max(0, point.value) / max) * PDF_HEIGHT,
              width: "100%",
            }}
          />
          <Text
            style={{
              fontSize: 9,
            }}
          >
            {point.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A bar or line chart rendered with Recharts. All data lives in props. */
export const chartBlock = defineBlock<"chart", ChartProps, ReactNode>({
  content: "none",
  render: (props) => <Chart {...props} />,
  schema: chartSchema,
  slash: [
    {
      defaultProps: {
        data: [
          {
            label: "A",
            value: 3,
          },
          {
            label: "B",
            value: 5,
          },
          {
            label: "C",
            value: 2,
          },
        ],
        kind: "bar",
      },
      icon: "▮",
      keywords: [
        "chart",
        "graph",
        "plot",
      ],
      label: "Chart",
    },
  ],
  toPdf: (block) => <ChartPdf block={block} />,
  toText: (block) =>
    block.props.data
      .map((point) => `${point.label}: ${point.value}`)
      .join("\n"),
  type: "chart",
});
