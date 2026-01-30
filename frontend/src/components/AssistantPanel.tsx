import React, { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function AssistantHeader() {
  return (
    <div className="h-12 px-4 flex items-center justify-between border-b border-zinc-800 bg-[#111]">
      <span className="text-sm text-zinc-300">New conversation</span>
      <button
        type="button"
        className="text-zinc-500 hover:text-white transition"
      >
        +
      </button>
    </div>
  );
}

function MessageArea({ messages }: { messages: Message[] }) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`text-sm ${
            message.role === "user"
              ? "text-right text-white"
              : "text-left text-zinc-300"
          }`}
        >
          {message.content}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

function PromptInput({
  input,
  setInput,
  onSend,
}: {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="border-t border-zinc-800 bg-[#111] px-3 py-0">
      <textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        rows={1}
        placeholder="Plan, @ for context, / for commands"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
        className="w-full resize-none bg-[#1a1a1a] text-[10px] text-zinc-200 placeholder:text-zinc-500 px-2 py-0 rounded-md outline-none focus:ring-1 focus:ring-zinc-700 leading-3"
      />
    </div>
  );
}

export default function AssistantPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;

    const newMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Generating your schedule...",
        },
      ]);
    }, 500);
  };

  return (
    <div className="h-full flex flex-col bg-[#0f0f0f] text-white">
      <AssistantHeader />
      <MessageArea messages={messages} />
      <PromptInput input={input} setInput={setInput} onSend={handleSend} />
    </div>
  );
}
