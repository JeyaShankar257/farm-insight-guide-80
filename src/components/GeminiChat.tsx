import { useEffect, useRef, useState } from "react";
import { Bot, Send, X, Sprout, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDataset } from "@/lib/agri/store";
import { type ChatMessage, sendChatMessage, createGroundedDatasetContext } from "@/lib/gemini";

type Message = ChatMessage & { id: number };

let idCounter = 0;
const nextId = () => ++idCounter;

const WELCOME: Message = {
    id: nextId(),
    role: "model",
    text: "Hello! I'm AgriInsight AI 🌱\n\nAsk me anything about crops, soil health, irrigation, pest management, or how to improve your farm's yield and profits.",
};

export function GeminiChat() {
    const { dataset, analysis } = useDataset();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([WELCOME]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    /* auto-scroll on new message */
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    /* focus textarea when popup opens */
    useEffect(() => {
        if (open) setTimeout(() => textareaRef.current?.focus(), 100);
    }, [open]);

    async function handleSend() {
        const text = input.trim();
        if (!text || loading) return;

        const userMsg: Message = { id: nextId(), role: "user", text };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setError(null);
        setLoading(true);

        try {
            if (!dataset || !analysis) {
                throw new Error("Please upload a farm dataset or load the demo data before asking farm questions.");
            }

            const groundedContext = createGroundedDatasetContext(
                dataset.name,
                analysis.totals,
                analysis.byField,
                analysis.byCrop,
                analysis.anomalies,
            );

            const history: ChatMessage[] = messages
                .slice(1)
                .map(({ role, text: t }) => ({ role, text: t }));
            const reply = await sendChatMessage(history, text, groundedContext);
            setMessages((prev) => [
                ...prev,
                { id: nextId(), role: "model", text: reply },
            ]);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Something went wrong. Try again.",
            );
        } finally {
            setLoading(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
        }
    }

    return (
        <>
            {/* Floating toggle button */}
            <button
                aria-label="Open AgriInsight AI chat"
                onClick={() => setOpen((v) => !v)}
                className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${open ? "rotate-90 scale-95 opacity-0 pointer-events-none" : "animate-pulse-slow"}`}
            >
                <Bot size={26} />
            </button>

            {/* Chat popup */}
            <div
                className={`fixed bottom-6 right-6 z-50 flex w-[380px] flex-col rounded-2xl border bg-card shadow-2xl shadow-black/15 transition-all duration-300 origin-bottom-right ${open ? "scale-100 opacity-100" : "scale-90 opacity-0 pointer-events-none"}`}
                style={{ height: "520px" }}
                aria-hidden={!open}
            >
                {/* Header */}
                <div className="flex items-center gap-3 rounded-t-2xl bg-primary px-4 py-3 text-primary-foreground">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20">
                        <Sprout size={18} />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold leading-none">AgriInsight AI</p>
                        <p className="mt-0.5 text-[11px] opacity-75">Powered by Gemini</p>
                    </div>
                    <button
                        aria-label="Close chat"
                        onClick={() => setOpen(false)}
                        className="rounded-lg p-1.5 opacity-75 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/50"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            {msg.role === "model" && (
                                <div className="mr-2 mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                                    <Sprout size={13} className="text-primary" />
                                </div>
                            )}
                            <div
                                className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === "user"
                                        ? "rounded-tr-sm bg-primary text-primary-foreground"
                                        : "rounded-tl-sm bg-muted text-foreground"
                                    }`}
                            >
                                {msg.text.split("\n").map((line, i) => (
                                    <span key={i}>
                                        {line}
                                        {i < msg.text.split("\n").length - 1 && <br />}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Typing indicator */}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="mr-2 mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                                <Sprout size={13} className="text-primary" />
                            </div>
                            <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                                <span className="flex gap-1">
                                    {[0, 1, 2].map((i) => (
                                        <span
                                            key={i}
                                            className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
                                            style={{ animationDelay: `${i * 150}ms` }}
                                        />
                                    ))}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Error banner */}
                    {error && (
                        <p
                            role="alert"
                            className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
                        >
                            {error}
                        </p>
                    )}

                    <div ref={bottomRef} />
                </div>

                {/* Input row */}
                <div className="flex items-end gap-2 border-t bg-background px-3 py-3 rounded-b-2xl">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about crops, soil, yield…"
                        className="flex-1 resize-none rounded-xl border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                        style={{ maxHeight: "96px", overflowY: "auto" }}
                        disabled={loading}
                    />
                    <Button
                        size="icon"
                        disabled={!input.trim() || loading}
                        onClick={() => void handleSend()}
                        className="h-9 w-9 flex-shrink-0 rounded-xl"
                        aria-label="Send message"
                    >
                        {loading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Send size={16} />
                        )}
                    </Button>
                </div>
            </div>
        </>
    );
}
