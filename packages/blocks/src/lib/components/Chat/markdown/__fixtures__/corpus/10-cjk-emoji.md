# Unicode in the wild

Real chat answers are rarely pure ASCII, so the parser has to treat multi-byte
text as ordinary characters and never split inside a grapheme.

日本語の段落です。ストリーミングパーサーは、文字コードの境界を越えても壊れては
いけません。これは重要なテスト条件です。

中文段落：解析器必须把每个汉字当作普通文本处理，绝不能在一个字符的中间断开。

And a line packed with emoji, including an astral zero-width-joiner sequence:
the family 👨‍👩‍👧‍👦 is a single grapheme made of four code points joined by ZWJ,
sitting next to a rocket 🚀, a checkmark ✅, and a waving hand 👋🏽 with a skin-tone
modifier. If any chunking strategy splits the surrogate pair, the reassembled
document must still come out byte-for-byte identical.
