---
"@useblocknotes/react": patch
---

Enter now always creates a paragraph, like Notion: at the end of a heading or any other non-list text block, at the start of a block (inserted before it) and in the title (with the text after the cursor). Before, the new block took the first registered block type or kept the current type. Lists and code blocks keep their behavior.
