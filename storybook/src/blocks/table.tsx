import { Text, View } from "@react-pdf/renderer";
import {
  type Block,
  type BlockRenderProps,
  defineBlock,
} from "@useblocknotes/core";
import type { ReactNode } from "react";
import * as z from "zod";

const tableSchema = z.object({
  rows: z.array(z.array(z.string()).min(1)).min(1),
});

/** Props of the table block: rows of cells, the first row is the header. */
export type TableProps = z.infer<typeof tableSchema>;

function Table({
  block,
  editable,
  updateProps,
}: BlockRenderProps<"table", TableProps>): ReactNode {
  const rows = block.props.rows;
  const columns = rows[0]?.length ?? 1;
  const setRows = (next: TableProps["rows"]): void =>
    updateProps({
      rows: next,
    });
  const setCell = (row: number, column: number, value: string): void =>
    setRows(
      rows.map((cells, r) =>
        r === row
          ? cells.map((cell, c) => (c === column ? value : cell))
          : cells,
      ),
    );
  return (
    <div
      className="sb-table"
      contentEditable={false}
    >
      <table>
        <tbody>
          {rows.map((cells, row) => (
            <tr key={`row-${row.toString()}`}>
              {cells.map((cell, column) => {
                const Cell = row === 0 ? "th" : "td";
                return (
                  <Cell key={`cell-${column.toString()}`}>
                    {editable ? (
                      <input
                        aria-label={`Row ${row + 1}, column ${column + 1}`}
                        onChange={(event) =>
                          setCell(row, column, event.target.value)
                        }
                        value={cell}
                      />
                    ) : (
                      cell
                    )}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {editable ? (
        <div className="sb-block-actions">
          <button
            onClick={() =>
              setRows([
                ...rows,
                Array.from(
                  {
                    length: columns,
                  },
                  () => "",
                ),
              ])
            }
            type="button"
          >
            Add row
          </button>
          <button
            onClick={() =>
              setRows(
                rows.map((cells) => [
                  ...cells,
                  "",
                ]),
              )
            }
            type="button"
          >
            Add column
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TablePdf({
  block,
}: {
  readonly block: Block<"table", TableProps>;
}): ReactNode {
  const rows = block.props.rows;
  return (
    <View
      style={{
        borderColor: "#d4d4d8",
        borderLeftWidth: 1,
        borderTopWidth: 1,
      }}
    >
      {rows.map((cells, row) => (
        <View
          key={`row-${row.toString()}`}
          style={{
            flexDirection: "row",
          }}
        >
          {cells.map((cell, column) => (
            <Text
              key={`cell-${column.toString()}`}
              style={{
                backgroundColor: row === 0 ? "#f4f4f5" : "#ffffff",
                borderBottomWidth: 1,
                borderColor: "#d4d4d8",
                borderRightWidth: 1,
                flex: 1,
                fontWeight: row === 0 ? "bold" : "normal",
                padding: 4,
              }}
            >
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/** A table of plain-text cells. All data lives in props. */
export const tableBlock = defineBlock<"table", TableProps, ReactNode>({
  content: "none",
  render: (props) => <Table {...props} />,
  schema: tableSchema,
  slash: [
    {
      defaultProps: {
        rows: [
          [
            "Column 1",
            "Column 2",
          ],
          [
            "",
            "",
          ],
        ],
      },
      icon: "▦",
      keywords: [
        "table",
        "grid",
      ],
      label: "Table",
    },
  ],
  toMarkdown: (block) => {
    const [header = [], ...body] = block.props.rows;
    const line = (cells: readonly string[]): string =>
      `| ${cells.map((cell) => cell.replaceAll("|", "\\|")).join(" | ")} |`;
    return [
      line(header),
      line(header.map(() => "---")),
      ...body.map(line),
    ].join("\n");
  },
  toPdf: (block) => <TablePdf block={block} />,
  toText: (block) =>
    block.props.rows.map((cells) => cells.join("\t")).join("\n"),
  type: "table",
});
