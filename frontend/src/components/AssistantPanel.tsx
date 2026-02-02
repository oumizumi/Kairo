"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Send } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const INITIAL_MESSAGES: Message[] = [];

function AgentHeader() {
  return (
    <div className="px-4 py-3 border-b border-neutral-200 bg-white/50">
      <h2 className="text-sm font-semibold text-neutral-800">Kairo Agent</h2>
      <p className="text-xs text-neutral-500">AI schedule assistant</p>
    </div>
  );
}

function MessageBubble({ message, index }: { message: Message; index: number }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div
        className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-neutral-800 text-white rounded-br-md"
            : "bg-white text-neutral-700 rounded-bl-md shadow-sm border border-neutral-100"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

function MessageArea({ messages }: { messages: Message[] }) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent">
      {messages.map((message, index) => (
        <MessageBubble key={message.id} message={message} index={index} />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function ModelSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState("Kairo v1");

  const models = ["Kairo v1", "Kairo v2", "Kairo Pro"];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200 rounded-md transition-colors"
      >
        <span>{selected}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-full left-0 mb-1 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-20 min-w-[100px]">
            {models.map((model) => (
              <button
                key={model}
                type="button"
                onClick={() => {
                  setSelected(model);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-xs text-left hover:bg-neutral-100 transition-colors ${
                  selected === model ? "text-neutral-900 font-medium" : "text-neutral-600"
                }`}
              >
                {model}
              </button>
            ))}
          </div>
        </>
      )}
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
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <div className="border-t border-neutral-200 bg-white px-3 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-2">
        <ModelSelector />
        <div className="flex-1 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Kairo…"
            className="w-full px-3 py-2 pr-10 text-sm bg-neutral-100 text-neutral-800 placeholder:text-neutral-400 rounded-full outline-none focus:ring-2 focus:ring-neutral-300 focus:bg-white transition-all"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={!input.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-neutral-800 text-white hover:bg-neutral-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AssistantPanel({ className = "" }: { className?: string }) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Simulated assistant response (UI only)
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Processing...",
        },
      ]);
    }, 600);
  };

  return (
    <div
      className={`h-screen flex flex-col bg-[#f5f5f5] border-l border-neutral-200 ${className}`}
    >
      <AgentHeader />
      <MessageArea messages={messages} />
      <PromptInput input={input} setInput={setInput} onSend={handleSend} />

      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: #d4d4d4;
          border-radius: 3px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background-color: #a3a3a3;
        }
      `}</style>
    </div>
  );
}
