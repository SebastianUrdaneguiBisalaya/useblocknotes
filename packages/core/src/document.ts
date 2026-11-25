/** A JSON primitive. */
export type JsonPrimitive = string | number | boolean | null;

/** Any JSON-serializable value. */
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | {
      readonly [key: string]: JsonValue;
    };

/** JSON-serializable props of a block or inline element. */
export type BlockProps = {
  readonly [key: string]: JsonValue;
};

/** Text formatting applied to a text node. */
export type Mark =
  | {
      readonly type: "bold" | "italic" | "underline" | "strike" | "code";
    }
  | {
      readonly type: "link";
      readonly href: string;
    };

/** A run of text inside a block, with optional marks. */
export interface TextNode {
  readonly type: "text";
  readonly text: string;
  readonly marks?: readonly Mark[];
}

/** A custom inline element (for example a citation), registered with `defineInline()`. */
export interface InlineElementNode<
  TType extends string = string,
  TProps extends BlockProps = BlockProps,
> {
  readonly type: TType;
  readonly props: TProps;
}

/** Inline content of a block: text runs and registered inline elements. */
export type InlineNode = TextNode | InlineElementNode;

/** A block of the document. */
export interface Block<
  TType extends string = string,
  TProps extends BlockProps = BlockProps,
> {
  /** Stable, unique id inside the document. */
  readonly id: string;
  /** Registered block type. */
  readonly type: TType;
  /** Props validated against the block's schema. */
  readonly props: TProps;
  /** Inline content. Only for blocks defined with `content: "inline"`. */
  readonly content?: readonly InlineNode[];
}

/** A serializable useblocknotes document. */
export interface BlockNotesDocument {
  readonly title: string;
  readonly blocks: readonly Block[];
}
