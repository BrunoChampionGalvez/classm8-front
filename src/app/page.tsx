"use client";
import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/config";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } from "docx";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [markdown, setMarkdown] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) setToken(t);
  }, []);

  const sanitizedHtml = useMemo(() => {
    const html = marked.parse(markdown || "");
    return DOMPurify.sanitize(html as string);
  }, [markdown]);

  const onLogin = async () => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setToken(data.token);
      localStorage.setItem("token", data.token);
    } catch (e: any) {
      setError(e.message || "Login failed");
    }
  };

  const onSignup = async () => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setToken(data.token);
      localStorage.setItem("token", data.token);
    } catch (e: any) {
      setError(e.message || "Signup failed");
    }
  };

  const onUploadAndProcess = async () => {
    if (!audioFile) {
      setError("Please choose an audio file.");
      return;
    }
    setLoading(true);
    setError(null);
    setTranscript("");
    setMarkdown("");
    try {
      const form = new FormData();
      form.append("audio", audioFile);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_URL}/process-audio`, {
        method: "POST",
        headers,
        body: form,
      });
      if (!res.ok) {
        if (res.status === 413) throw new Error("File too large for server limit.");
        throw new Error(await res.text());
      }
      const data = await res.json();
      setTranscript(data.transcript);
      // Assume notes is returned as Markdown string
      setMarkdown(data.notes || "");
    } catch (e: any) {
      setError(e.message || "Processing failed");
    } finally {
      setLoading(false);
    }
  };

  const onExportDocx = async () => {
    if (!markdown) return;
    // Use marked lexer for structured tokens
    const tokens = marked.lexer(markdown, { gfm: true });
    const paragraphs: Paragraph[] = [];

    const headingLevelMap: Record<number, { level: any; size: number; }> = {
      1: { level: HeadingLevel.HEADING_1, size: 36 },
      2: { level: HeadingLevel.HEADING_2, size: 32 },
      3: { level: HeadingLevel.HEADING_3, size: 28 },
      4: { level: HeadingLevel.HEADING_4, size: 26 },
      5: { level: HeadingLevel.HEADING_5, size: 24 },
      6: { level: HeadingLevel.HEADING_6, size: 24 },
    };

    // Helpers
    const pushBlank = () => paragraphs.push(new Paragraph({ text: "" }));

  const baseFontSize = 24; // half-points -> 12pt
  const baseFont = 'Times New Roman';
  const baseColor = '000000';
    const formatInline = (text: string): TextRun[] => {
      // Basic inline formatting: bold **, italics *, inline code `code`, links [text](url)
      const runs: TextRun[] = [];
      const inlineRegex = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)|(!?\[[^\]]+\]\([^\)]+\))/g;
      let last = 0; let m: RegExpExecArray | null;
      while ((m = inlineRegex.exec(text))) {
        if (m.index > last) runs.push(new TextRun(text.slice(last, m.index)));
        const seg = m[0];
        if (seg.startsWith('**')) {
          runs.push(new TextRun({ text: seg.slice(2, -2), bold: true, size: baseFontSize, font: baseFont, color: baseColor }));
        } else if (seg.startsWith('*')) {
          runs.push(new TextRun({ text: seg.slice(1, -1), italics: true, size: baseFontSize, font: baseFont, color: baseColor }));
        } else if (seg.startsWith('`')) {
          runs.push(new TextRun({ text: seg.slice(1, -1), font: { name: 'Consolas' }, size: baseFontSize, color: baseColor }));
        } else if (seg.startsWith('![')) {
          // image alt text only
          const alt = seg.substring(2, seg.indexOf(']'));
          runs.push(new TextRun({ text: `[Image: ${alt}]`, italics: true, size: baseFontSize, font: baseFont, color: baseColor }));
        } else if (seg.startsWith('[')) {
          const close = seg.indexOf(']');
            const linkText = seg.substring(1, close);
            const url = seg.substring(seg.indexOf('(', close) + 1, seg.length - 1);
            runs.push(new TextRun({ text: linkText, underline: {}, color: baseColor, size: baseFontSize, font: baseFont }));
            runs.push(new TextRun({ text: ` (${url})`, italics: true, color: baseColor, size: baseFontSize - 2, font: baseFont }));
        }
        last = m.index + seg.length;
      }
      if (last < text.length) runs.push(new TextRun({ text: text.slice(last), size: baseFontSize, font: baseFont, color: baseColor }));
      return runs.length ? runs : [new TextRun({ text, size: baseFontSize, font: baseFont, color: baseColor })];
    };

    const walk = (toks: any[], listContext?: { ordered: boolean; indent: number }) => {
      for (const t of toks) {
        switch (t.type) {
          case 'space':
            break;
          case 'heading': {
            const cfg = headingLevelMap[t.depth] || headingLevelMap[3];
            paragraphs.push(new Paragraph({
              heading: cfg.level,
              children: [new TextRun({ text: t.text, bold: true, size: cfg.size, font: baseFont, color: baseColor })],
              spacing: { after: 120, before: 160 },
            }));
            break; }
          case 'paragraph':
            paragraphs.push(new Paragraph({ children: formatInline(t.text), spacing: { after: 160 } }));
            break;
          case 'blockquote':
            // Render each token indented with a left bar effect using leading char
            walk(t.tokens.map((x: any) => ({ ...x, _blockquote: true })), listContext);
            break;
          case 'list': {
            const nextIndent = (listContext?.indent || 0) + 1;
            t.items.forEach((item: any, idx: number) => {
              // Item.text may already contain concatenated inline text; nested content is in item.tokens
              const marker = t.ordered ? `${item.start !== undefined ? item.start : idx + 1}. ` : '• ';
              const itemInline = formatInline(item.text || '');
              paragraphs.push(new Paragraph({
                children: [new TextRun({ text: marker, size: baseFontSize, font: baseFont, color: baseColor }), ...itemInline],
                indent: { left: nextIndent * 720 },
                spacing: { after: 40 },
              }));
              if (item.tokens) {
                // Filter out leading tokens that duplicate the list item's own text content
                const itemTextNorm = (item.text || '').replace(/\s+/g, ' ').trim();
                const filtered = item.tokens.filter((tok: any, i: number) => {
                  if (i === 0 && tok.text) {
                    const tokNorm = String(tok.text).replace(/\s+/g, ' ').trim();
                    if (tokNorm === itemTextNorm) return false; // duplicate
                  }
                  // Also skip simple 'paragraph' token duplicating the list text
                  if (tok.type === 'paragraph' && tok.text) {
                    const tokNorm2 = String(tok.text).replace(/\s+/g, ' ').trim();
                    if (tokNorm2 === itemTextNorm) return false;
                  }
                  // Skip trivial space tokens
                  if (tok.type === 'space') return false;
                  return true;
                });
                if (filtered.length) {
                  walk(filtered, { ordered: t.ordered, indent: nextIndent });
                }
              }
            });
            break; }
          case 'codespan':
            paragraphs.push(new Paragraph({ children: [new TextRun({ text: t.text, font: { name: 'Consolas' }, size: baseFontSize, color: baseColor })] }));
            break;
          case 'code':
            paragraphs.push(new Paragraph({
              children: [new TextRun({ text: t.text, font: { name: 'Consolas' }, size: baseFontSize, color: baseColor })],
              spacing: { after: 160 },
            }));
            break;
          case 'hr':
            paragraphs.push(new Paragraph({ children: [new TextRun({ text: '―'.repeat(30), italics: true, color: baseColor, size: baseFontSize })], alignment: AlignmentType.CENTER, spacing: { before: 160, after: 160 } }));
            break;
          case 'strong':
            paragraphs.push(new Paragraph({ children: [new TextRun({ text: t.text, bold: true, size: baseFontSize, font: baseFont, color: baseColor })] }));
            break;
          case 'em':
            paragraphs.push(new Paragraph({ children: [new TextRun({ text: t.text, italics: true, size: baseFontSize, font: baseFont, color: baseColor })] }));
            break;
          case 'table':
            t.rows.forEach((row: any, rIdx: number) => {
              const txt = row.map((c: any) => c.text).join('    ');
              const rowRuns = formatInline(txt);
              // Rebuild runs with base size and optional bold for header row
              const rebuilt = rowRuns.map(run => new TextRun({
                text: (run as any).options?.text || (run as any).text || txt,
                bold: rIdx === 0 ? true : undefined,
                size: baseFontSize,
                font: baseFont,
                color: baseColor,
              }));
              paragraphs.push(new Paragraph({ children: rebuilt, spacing: { after: 40 } }));
            });
            break;
          case 'html':
            // Skip raw HTML blocks
            break;
          default:
            if (t.text) paragraphs.push(new Paragraph({ children: formatInline(t.text), spacing: { after: 160 } }));
            break;
        }
      }
    };

    walk(tokens);

    // Add small top margin to headings (docx requires explicit spacing adjustments if desired)
    const doc = new Document({ sections: [{ children: paragraphs }] });
    const blob = await Packer.toBlob(doc);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "notes.docx";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="min-h-screen p-6 flex flex-col gap-6 max-w-5xl mx-auto">
      <header className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
        <h1 className="text-2xl font-bold">Audio Notes</h1>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="email"
              className="px-2 py-1 border rounded"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="password"
              className="px-2 py-1 border rounded"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={onLogin} className="px-3 py-2 bg-black text-white rounded">Log in</button>
            <button onClick={onSignup} className="px-3 py-2 bg-gray-300 text-gray-700 rounded">Sign up</button>
            <button onClick={() => { setToken(null); localStorage.removeItem('token'); }} className="px-3 py-2 border rounded">Log out</button>
          </div>
        </div>
      </header>

      {token ? (
        <div className="text-sm text-green-700">Authenticated</div>
      ) : (
        <div className="text-sm text-yellow-700">Not authenticated</div>
      )}

      <section className="flex flex-col gap-3 border rounded p-4">
        <h2 className="text-xl font-semibold">Upload audio</h2>
        <input
          type="file"
          accept="audio/m4a,audio/x-m4a,audio/aac,audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/x-caf"
          onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
        />
        <div className="flex gap-2">
          <button
            onClick={onUploadAndProcess}
            disabled={!audioFile || loading}
            className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {loading ? "Processing…" : "Transcribe & Generate Notes"}
          </button>
          <button
            onClick={onExportDocx}
            disabled={!markdown}
            className="px-3 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
          >
            Export DOCX
          </button>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
      </section>

      {!!transcript && (
        <section className="border rounded p-4">
          <h3 className="text-lg font-semibold">Transcript</h3>
          <p className="text-sm text-gray-700">{transcript}</p>
        </section>
      )}

      {!!markdown && (
        <section className="border rounded p-4">
          <h3 className="text-lg font-semibold mb-2">Notes (rendered)</h3>
          <div className="prose" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
        </section>
      )}
    </div>
  );
}
