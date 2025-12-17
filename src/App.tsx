import React, { useEffect, useState, useRef } from "react";
import "./index.css"
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  role?:"user" | "assistant";
  content?: string;
}

interface UploadFormProps {
  uploadUrl: string;
  deleteUrl: string;
  onStatus: (msg: string) => void;
  documentid: string[];
}

const UploadForm: React.FC<UploadFormProps> = ({ uploadUrl,deleteUrl,documentid, onStatus }) => {
  const [uploadCategory, setUploadCategory] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) {
      onStatus("Please choose a file first.");
      return;
    }
    if (!uploadCategory) {
      onStatus("Please enter a category.");
      return;
    }

    const form = new FormData();
    form.append("category", uploadCategory);
    form.append("file", files[0]);
    onStatus("Uploading...");
    try {
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: form,
      });
      const statusmsg=await res.json();
      if(res.status==400){
        alert(statusmsg)
      }


      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      onStatus("Upload successful.");
    } catch (err) {
      console.error(err);
      onStatus("Upload failed.");
    }
  }
async function handledelete(e: React.FormEvent) {
    e.preventDefault();
    if(confirm("Are You Sure You Want to Clear All Colletion?")){
    try{
      const resp= await fetch(deleteUrl,{method:"POST",headers:{ "Content-Type":"text/plain"} ,body: "Yes"})
      if(resp.ok){
      onStatus("Delete Successfull");}
    }
    catch(err){
      console.log(err);
      onStatus("Upload Failed");
    }}
  }

  return (
    <form onSubmit={handleUpload} className="left  rounded-lg p-4 shadow-sm bg-[#171717] h-[80%] ">
      <h3 className="font-medium mb-2 text-white">Upload File</h3>
      <input ref={fileInputRef} type="file" className="block w-full mb-2 text-white" />
      <input
        value={uploadCategory}
        onChange={(e) => setUploadCategory(e.target.value.toLowerCase())}
        placeholder="Category"
        className="w-full mb-2 input border p-2 rounded text-white bg-[#171717]"
      />
      <button className="bg-blue-600  text-white px-3 py-2 rounded" type="submit">
        Upload
      </button>
         <button className="bg-red-600 px-3 py-2 text-white ml-3 rounded" onClick={handledelete} >
        Delete
      </button>
      <h3 className="text-white mt-24">Files Picked</h3>
        <ul className="text-white">
          {documentid.map((id, i) => (
            <li key={i}>{id}</li>
          ))}
        </ul>
    </form>
  );
};

interface ChatBoxProps {
  chatUrl: string;
  tokenLimit: number;
  sessionId: string;
  onStatus: (msg: string) => void;
  documentid: string[];
  setdocumentid: React.Dispatch<React.SetStateAction<string[]>>;
}


const ChatBox: React.FC<ChatBoxProps> = ({ chatUrl, tokenLimit, sessionId,setdocumentid, onStatus }) => {
  const CHAT_KEY = `chat_history_${sessionId}`;
  const TOK_KEY = `token_count_${sessionId}`;

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    const raw = sessionStorage.getItem(CHAT_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  });
  const [tokenCount, setTokenCount] = useState<number>(() => {
    const raw = sessionStorage.getItem(TOK_KEY);
    return raw ? Number(raw) :0;
  });

  const [query, setQuery] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [intent,setIntent]= useState("order")
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const [toomany,settoomany]= useState(false);

  useEffect(() => {
    sessionStorage.setItem(CHAT_KEY, JSON.stringify(chatHistory));
  }, [chatHistory]);

  useEffect(() => {
    sessionStorage.setItem(TOK_KEY, String(tokenCount));
  }, [tokenCount]);

  function trimHistory(history: ChatMessage[]) {
    return history.length <= 10 ? history : history.slice(history.length - 10);
  }

  async function sendQuery() {
    if (!query.trim()) return;
    if (tokenCount >= tokenLimit) {
      onStatus("Token limit reached. You cannot send more queries.");
      return;
    }

    const newHistory = trimHistory([...chatHistory, { role:"user", content:query }]);
    setChatHistory(newHistory);
    setIsSending(true);
    onStatus("Waiting for response...");

    try {
      const body = { query, chat_history: newHistory,intent };
      const res = await fetch(chatUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();

      if(res.status==429){
        alert(j.detail)
        settoomany(true)
      }

      const assistantText: string = j[0];
      const tokensUsed: number = Number(j[1]?? 0);
      setIntent(j[2])
      setdocumentid(j[3])
        
      const newTokenTotal = tokenCount + tokensUsed;
      setTokenCount(newTokenTotal);

      const afterHistory = trimHistory([...newHistory, { role:"assistant", content:assistantText !== undefined ? assistantText : "" }]);
      setChatHistory(afterHistory);
      if (newTokenTotal >= tokenLimit) {
        onStatus(`Token limit reached (>= ${tokenLimit}). Further queries blocked.`);
      } else {
        onStatus(`Response received. Tokens used: ${tokensUsed}`);
      }

      setQuery("");
      requestAnimationFrame(() => {
        messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight, behavior: "smooth" });
      });
    } catch (err: any) {
      console.error(err);
      onStatus("Error getting response: " + (err.message || err));
    } finally {
      setIsSending(false);
    }
  }

  const remaining = Math.max(0, tokenLimit - tokenCount);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuery();
    }
  }

  return (
    <div className="rounded-lg shadow-sm h-screen">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium text-white">Chat</h3>
        <h3 className="font-medium text-white">Intent:
        <select
      className="ml-2 rounded-md bg-gray-800 text-white text-sm px-2 py-1 outline-none border border-gray-600"
      onChange={(e) => setIntent(e.target.value)}
      value={intent}
      >
      <option value="order">Order</option>
      <option value="act">Act</option>
    </select>
      </h3>
        <div className="text-sm text-white">
          Tokens used: <strong>{tokenCount}</strong> • Remaining: <strong>{remaining}</strong>
        </div>
      </div>

      <div ref={messageListRef} className="overflow-auto  rounded-lg p-3 mb-3  h-[65%]  bg-[rgb(40,40,40)] border border-gray-800">
        {chatHistory.length === 0 && <div className="text-sm text-white">No messages yet.</div>}
        {chatHistory.map((m, i) => (
          <div key={i} className={`mb-3 flex whitespace-pre-line ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.content !== undefined &&(
              <>
                <div className={`inline-block p-2 rounded-md ${ m.role === "user" ? "bg-gray-600 text-white ml-[30%] " : "mr-[30%] bg-gray-900 text-white"}`}>
               <ReactMarkdown>
                {m.content}
                </ReactMarkdown> 
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={tokenCount >= tokenLimit ? "Token limit reached — cannot send." : "Type your message and press Enter to send"}
          className="flex-1 border rounded p-2 h-20 resize-none bg-[#171717] text-white border-[rgb(100,100,100)]"
          disabled={isSending || tokenCount >= tokenLimit || toomany}
        />
        <div className="flex flex-col">
          <button
            className={`px-4 py-2 rounded mb-2 ${isSending || tokenCount >= tokenLimit ? "bg-gray-400" : "bg-green-600 text-white"}`}
            onClick={sendQuery}
            disabled={isSending || tokenCount >= tokenLimit || toomany}
          >
            {isSending ? "Sending..." : "Send"}
          </button>
          <button
            className="px-4 py-2 rounded bg-yellow-500 text-black"
            onClick={() => {
              if (confirm("Clear chat history and token count for this session?")) {
                setChatHistory([]);
                setTokenCount(0);
                onStatus("Session cleared.");
                setIntent("order")
                setdocumentid([])
              }
            }}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};
export default function LLMChatFrontend({
  uploadUrl = import.meta.env.VITE_UPLOAD_URL,
  chatUrl = import.meta.env.VITE_CHAT_URL,
  deleteUrl= import.meta.env.VITE_DELETE_URL,
  tokenLimit = 100000,
}: {
  uploadUrl?: string;
  chatUrl?: string;
  deleteUrl?:string;
  tokenLimit?: number;
}) {
  const [statusMessage, setStatusMessage] = useState("");
  const [documentid, setdocumentid] = useState<string[]>([]);
  const [sessionId] = useState(() => {
    let id = sessionStorage.getItem("llm_session_id");
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem("llm_session_id", id);
    }
    return id;
  });

  return (

    <div className=" p-10 bg-[#171717] h-full overflow-hidden">
      <h2 className="text-2xl font-semibold mb-2 text-white">The LAWS</h2>
      <div className="text-sm  mt-2 text-white">{statusMessage}</div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ">
        <UploadForm uploadUrl={uploadUrl} deleteUrl={deleteUrl}  documentid={documentid} onStatus={setStatusMessage} />
        <div className="col-span-2">
          <ChatBox chatUrl={chatUrl} tokenLimit={tokenLimit} sessionId={sessionId} documentid={documentid} setdocumentid={setdocumentid} onStatus={setStatusMessage} />
        </div>
      </div>

    </div>
  );
}
