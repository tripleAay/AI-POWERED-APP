"use client";

import { useState } from "react";
import { AiOutlineSend } from "react-icons/ai";
import "tailwindcss/tailwind.css";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);

    const newMessage = { text: input, user: "me", language: "Detecting..." };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");

    try {
      const detectedLang = await detectLanguage(input);
      setMessages((prev) =>
        prev.map((msg, i) =>
          i === prev.length - 1 ? { ...msg, language: detectedLang } : msg
        )
      );

      if (detectedLang === "en" && input.length > 150) {
        setMessages((prev) =>
          prev.map((msg, i) =>
            i === prev.length - 1 ? { ...msg, canSummarize: true } : msg
          )
        );
      }
    } catch (error) {
      console.error("Error detecting language:", error);
    }
    setLoading(false);
  };

  const detectLanguage = async (text) => {
    try {
      const response = await fetch("https://api.chromeai.com/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      return data.language || "Unknown";
    } catch (error) {
      console.error("Error detecting language:", error);
      return "Unknown";
    }
  };

  const summarizeText = async (text) => {
    try {
      const response = await fetch("https://api.chromeai.com/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      return data.summary || "Could not summarize.";
    } catch (error) {
      console.error("Error summarizing text:", error);
      return "Could not summarize.";
    }
  };

  const translateText = async (text, targetLang) => {
    try {
      const response = await fetch("https://api.chromeai.com/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLang }),
      });
      const data = await response.json();
      return data.translatedText || "Translation failed.";
    } catch (error) {
      console.error("Error translating text:", error);
      return "Translation failed.";
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#89023E] p-4">
      <div className="flex-1 overflow-y-auto space-y-4 p-2">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.user === "me" ? "justify-end" : "justify-start"}`}
          >
            <div className="bg-white p-3 rounded-lg shadow-md w-3/4">
              <p className="font-semibold">{msg.user === "me" ? "You" : "AI"}</p>
              <p>{msg.text}</p>
              <p className="text-xs text-gray-500">Language: {msg.language}</p>

              {msg.canSummarize && (
                <button
                  className="text-blue-500"
                  onClick={async () => {
                    const summary = await summarizeText(msg.text);
                    setMessages((prev) =>
                      prev.map((m, i) =>
                        i === idx ? { ...m, summary } : m
                      )
                    );
                  }}
                >
                  Summarize
                </button>
              )}

              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="border rounded p-1 text-sm"
              >
                {[
                  { code: "en", name: "English" },
                  { code: "pt", name: "Portuguese" },
                  { code: "es", name: "Spanish" },
                  { code: "ru", name: "Russian" },
                  { code: "tr", name: "Turkish" },
                  { code: "fr", name: "French" },
                ].map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>

              <button
                className="text-green-500 ml-2"
                onClick={async () => {
                  const translated = await translateText(msg.text, selectedLanguage);
                  setMessages((prev) =>
                    prev.map((m, i) =>
                      i === idx ? { ...m, translated } : m
                    )
                  );
                }}
              >
                Translate
              </button>

              {msg.summary && (
                <p className="text-sm text-gray-600">Summary: {msg.summary}</p>
              )}
              {msg.translated && (
                <p className="text-sm text-gray-600">Translated: {msg.translated}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 p-3 bg-white shadow-md rounded-lg">
        <textarea
          className="flex-1 border p-2 rounded-md"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Write here..."
        ></textarea>
        <button
          className="p-2 bg-blue-500 text-white rounded-full"
          onClick={sendMessage}
          disabled={loading}
        >
          <AiOutlineSend size={24} />
        </button>
      </div>
    </div>
  );
}
