"use client";
import { useState, useCallback } from "react";
import { AiOutlineSend } from "react-icons/ai";
import "tailwindcss/tailwind.css";
import 'dotenv/config'


// Validate environment variables
const validateEnvVariables = () => {
  const requiredVars = {
    NEXT_PUBLIC_GOOGLE_TRANSLATE_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_API_KEY,
    NEXT_PUBLIC_OPENAI_API_KEY: process.env.NEXT_PUBLIC_OPENAI_API_KEY
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

// API configuration with error handling
const API_CONFIG = {
  TIMEOUT: 5000,
  ENDPOINTS: {
    TRANSLATE: 'https://translation.googleapis.com/language/translate/v2',
    DETECT: 'https://translation.googleapis.com/language/translate/v2/detect',
    SUMMARIZE: 'https://api.openai.com/v1/chat/completions'
  }
};

// Custom hook for API calls with enhanced error handling
const useApiCall = () => {
  const [error, setError] = useState(null);

  const handleApiError = (error, context) => {
    console.error(`API Error in ${context}:`, error);

    // Network errors
    if (error.name === 'AbortError') {
      return `Request timeout after ${API_CONFIG.TIMEOUT}ms`;
    }

    if (!navigator.onLine) {
      return 'No internet connection';
    }

    // API specific errors
    if (error.response) {
      const status = error.response.status;
      switch (status) {
        case 401:
          return 'Invalid API key';
        case 403:
          return 'API quota exceeded';
        case 429:
          return 'Too many requests';
        default:
          return `Server error (${status})`;
      }
    }

    return 'An unexpected error occurred';
  };

  const fetchWithTimeout = useCallback(async (url, options = {}, timeout = API_CONFIG.TIMEOUT) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      validateEnvVariables();

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      return response;
    } catch (error) {
      clearTimeout(id);
      const errorMessage = handleApiError(error, 'fetchWithTimeout');
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const detectLanguage = useCallback(async (text) => {
    try {
      const url = new URL(API_CONFIG.ENDPOINTS.DETECT);
      url.searchParams.append('q', text);
      url.searchParams.append('key', process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_API_KEY);

      const response = await fetchWithTimeout(url.toString());
      const data = await response.json();

      if (!data?.data?.detections?.[0]?.[0]?.language) {
        throw new Error('Invalid API response format');
      }

      return data.data.detections[0][0].language;
    } catch (error) {
      const errorMessage = handleApiError(error, 'detectLanguage');
      setError(errorMessage);
      return 'unknown';
    }
  }, [fetchWithTimeout]);

  const translateText = useCallback(async (text, targetLanguage) => {
    try {
      const url = new URL(API_CONFIG.ENDPOINTS.TRANSLATE);
      url.searchParams.append("q", text);
      url.searchParams.append("target", targetLanguage);
      url.searchParams.append("key", process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_API_KEY);

      const response = await fetchWithTimeout(url.toString());
      const data = await response.json();

      if (!data?.data?.translations?.[0]?.translatedText) {
        throw new Error("Invalid API response format");
      }

      return data.data.translations[0].translatedText;
    } catch (error) {
      const errorMessage = handleApiError(error, "translateText");
      setError(errorMessage);
      return "Translation failed";
    }
  }, [fetchWithTimeout]);

  const summarizeText = useCallback(async (text) => {
    try {
      const response = await fetchWithTimeout(API_CONFIG.ENDPOINTS.SUMMARIZE, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "system", content: "Summarize the following text" }, { role: "user", content: text }],
          temperature: 0.7,
        }),
      });

      const data = await response.json();

      if (!data?.choices?.[0]?.message?.content) {
        throw new Error("Invalid API response format");
      }

      return data.choices[0].message.content;
    } catch (error) {
      const errorMessage = handleApiError(error, "summarizeText");
      setError(errorMessage);
      return "Summarization failed";
    }
  }, [fetchWithTimeout]);

  return { detectLanguage, translateText, summarizeText, error };
};

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [loading, setLoading] = useState(false);
  const { detectLanguage, translateText, summarizeText, error } = useApiCall();

  // Add error display
  const ErrorMessage = ({ message }) => (
    message ? (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{message}</span>
      </div>
    ) : null
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Prevents new line in textarea
      console.log("Enter key pressed:", input);
      // Handle form submission or other logic here
    }
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim()) return;

    setLoading(true);
    try {
      validateEnvVariables();

      const newMessage = { text: input, user: "me", language: "Detecting..." };
      setMessages(prev => [...prev, newMessage]);
      setInput("");

      const detectedLang = await detectLanguage(input);

      setMessages(prev =>
        prev.map((msg, idx) =>
          idx === prev.length - 1 ? {
            ...msg,
            language: detectedLang,
            canSummarize: detectedLang === "en" && input.length > 150
          } : msg
        )
      );
    } catch (error) {
      console.error("Error in message processing:", error);
      setMessages(prev =>
        prev.map((msg, idx) =>
          idx === prev.length - 1 ? { ...msg, language: "Detection failed" } : msg
        )
      );
    } finally {
      setLoading(false);
    }
  }, [input, detectLanguage]);

  return (
    <div className="flex flex-col h-screen bg-[#89023E] p-4">
      <div className="flex-1 overflow-y-auto space-y-4 p-2">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.user === "me" ? "justify-end" : "justify-start"}`}>
            <div className="bg-white p-3 rounded-lg shadow-md w-3/4">
              <p className="font-semibold">{msg.user === "me" ? "You" : "AI"}</p>
              <p>{msg.text}</p>
              <p className="text-xs text-gray-500">Language: {msg.language}</p>

              {msg.canSummarize && (
                <button
                  className="text-blue-500"
                  onClick={async () => {
                    // Show loading state for summary
                    setMessages((prev) =>
                      prev.map((m, i) => (i === idx ? { ...m, summaryLoading: true } : m))
                    );

                    const summary = await summarizeText(msg.text);

                    setMessages((prev) =>
                      prev.map((m, i) => (i === idx ? { ...m, summary, summaryLoading: false } : m))
                    );
                  }}
                >
                  {msg.summaryLoading ? "Summarizing..." : "Summarize"}
                </button>
              )}

              <div className="mt-2 flex items-center">
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
                    { code: "fr", name: "French" }
                  ].map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>

                <button
                  className="text-green-500 ml-2 px-2 py-1 rounded hover:bg-green-50"
                  onClick={async () => {
                    // Show loading state for translation
                    setMessages((prev) =>
                      prev.map((m, i) => (i === idx ? { ...m, translationLoading: true } : m))
                    );

                    const translated = await translateText(msg.text, selectedLanguage);

                    setMessages((prev) =>
                      prev.map((m, i) => (i === idx ? { ...m, translated, translationLoading: false } : m))
                    );
                  }}
                >
                  {msg.translationLoading ? "Translating..." : "Translate"}
                </button>
              </div>

              {msg.summary && (
                <div className="mt-2 p-2 bg-blue-50 rounded-md">
                  <p className="text-sm font-medium text-blue-700">Summary:</p>
                  <p className="text-sm text-gray-700">{msg.summary}</p>
                </div>
              )}

              {msg.translated && (
                <div className="mt-2 p-2 bg-green-50 rounded-md">
                  <p className="text-sm font-medium text-green-700">Translated:</p>
                  <p className="text-sm text-gray-700">{msg.translated}</p>
                </div>
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
          onKeyDown={handleKeyDown}
          placeholder="Write here..."
          rows={2}
        ></textarea>
        <button
          className={`p-2 rounded-full ${loading ? "bg-gray-400" : "bg-blue-500 hover:bg-blue-600"} text-white`}
          onClick={sendMessage}
          disabled={loading}
        >
          <AiOutlineSend size={24} />
        </button>
      </div>
    </div>
  );
}